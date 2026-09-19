import { AlbumModel, ArtistModel, TrackModel } from "../../database/Models";
import { Album, SpotifyAlbum } from "../../database/schemas/album";
import {
  Artist,
  SpotifyArtist as FullArtist,
} from "../../database/schemas/artist";
import { SpotifyTrack, Track } from "../../database/schemas/track";
import { trafficStats } from "../apis/trafficStats";
import { logger } from "../logger";

/**
 * Persistent catalog cache.
 *
 * OnRecord already stores every track, album and artist it has ever seen, and
 * that metadata is effectively immutable (name, album, artists, duration,
 * cover art). This module lets imports answer an id from MongoDB before ever
 * contacting Spotify, which is what turns a re-import from "fetch everything
 * again" into "fetch only what is genuinely new".
 *
 * Documents are reconstructed into the nested shape importers expect
 * (`SpotifyTrack` with a populated album and artist objects), because the
 * stored tracks reference albums and artists by id only.
 *
 * A short-lived in-process layer sits in front of MongoDB to absorb the
 * repeated lookups a single import performs, but unlike the previous cache it
 * is only an optimisation: the authoritative data lives in the database, so
 * process restarts no longer discard it.
 */

/** Negative lookups are cached in-process only, for a bounded time. */
const NEGATIVE_TTL_MS = 10 * 60 * 1000;

const negativeCache = new Map<string, number>();

function isNegativelyCached(id: string, now = Date.now()): boolean {
  const expiresAt = negativeCache.get(id);
  if (expiresAt === undefined) {
    return false;
  }
  if (expiresAt <= now) {
    negativeCache.delete(id);
    return false;
  }
  return true;
}

/** Records that Spotify could not resolve an id, so it is not asked again soon. */
export function markMissingFromSpotify(id: string, now = Date.now()) {
  negativeCache.set(id, now + NEGATIVE_TTL_MS);
}

export function clearNegativeCache() {
  negativeCache.clear();
}

/** Test/observability helper. */
export function negativeCacheSize() {
  return negativeCache.size;
}

const toArtist = (artist: {
  id: string;
  name?: string | undefined;
  genres?: string[] | undefined;
  images?: unknown;
  external_urls?: unknown;
  href?: string | undefined;
  type?: string | undefined;
  uri?: string | undefined;
}): FullArtist =>
  ({
    id: artist.id,
    name: artist.name ?? "",
    genres: artist.genres ?? [],
    images: artist.images ?? [],
    external_urls: artist.external_urls ?? {},
    href: artist.href ?? "",
    type: artist.type ?? "artist",
    uri: artist.uri ?? `spotify:artist:${artist.id}`,
  }) as FullArtist;

/**
 * Resolves stored tracks into the nested shape importers and the play loop
 * expect. Returns a Map so callers can preserve their own ordering, and omits
 * ids that are not fully resolvable so they fall through to Spotify.
 */
export async function getCachedTracks(
  ids: string[],
): Promise<Map<string, SpotifyTrack>> {
  const resolved = new Map<string, SpotifyTrack>();
  if (ids.length === 0) {
    return resolved;
  }

  const tracks = await TrackModel.find({ id: { $in: ids } }).lean();
  if (tracks.length === 0) {
    return resolved;
  }

  const albumIds = [...new Set(tracks.map((track) => track.album))];
  const artistIds = [
    ...new Set(
      tracks.flatMap((track) => [...(track.artists ?? []), track.album ?? ""]),
    ),
  ];
  const [albums, artists] = await Promise.all([
    AlbumModel.find({ id: { $in: albumIds } }).lean(),
    ArtistModel.find({ id: { $in: artistIds.filter(Boolean) } }).lean(),
  ]);
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const artistById = new Map(artists.map((artist) => [artist.id, artist]));

  for (const track of tracks) {
    const album = albumById.get(track.album);
    if (!album) {
      // Without the album the nested shape is incomplete; let Spotify fill it.
      continue;
    }
    const trackArtists = (track.artists ?? [])
      .map((artistId) => artistById.get(artistId))
      .filter((artist): artist is NonNullable<typeof artist> =>
        Boolean(artist),
      );
    if (trackArtists.length === 0) {
      continue;
    }
    const albumArtists = (album.artists ?? [])
      .map((artistId) => artistById.get(artistId))
      .filter((artist): artist is NonNullable<typeof artist> =>
        Boolean(artist),
      );

    resolved.set(track.id, {
      id: track.id,
      name: track.name,
      album: {
        ...album,
        artists:
          albumArtists.length > 0
            ? albumArtists.map(toArtist)
            : trackArtists.map(toArtist),
      } as unknown as SpotifyAlbum,
      artists: trackArtists.map(toArtist),
      disc_number: track.disc_number,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      external_urls: track.external_urls,
      href: track.href,
      is_local: track.is_local,
      preview_url: track.preview_url,
      track_number: track.track_number,
      type: track.type,
      uri: track.uri,
    } as SpotifyTrack);
  }

  return resolved;
}

/**
 * Splits ids into those the database can answer and those Spotify still needs.
 */
export async function partitionCachedIds(
  ids: string[],
): Promise<{ cached: Map<string, SpotifyTrack>; uncached: string[] }> {
  const now = Date.now();
  const toLookup = ids.filter((id) => !isNegativelyCached(id, now));
  const cached = await getCachedTracks(toLookup);
  const uncached = toLookup.filter((id) => !cached.has(id));
  trafficStats.recordCacheHits(cached.size);
  trafficStats.recordCacheMisses(uncached.length);
  logger.debug?.(
    `[catalog-cache] ${cached.size}/${ids.length} ids resolved from the database; ${uncached.length} need Spotify`,
  );
  return { cached, uncached };
}

/**
 * Persists fetched catalog data so future imports and restarts reuse it
 * instead of re-requesting Spotify. Albums and artists are stored first so a
 * cached track is always fully resolvable on the next read.
 */
export async function storeCatalogForCache(tracks: SpotifyTrack[]) {
  if (tracks.length === 0) {
    return;
  }
  const albums = new Map<string, Album>();
  const artists = new Map<string, Artist>();
  const flatTracks: Track[] = [];

  for (const track of tracks) {
    flatTracks.push({
      ...track,
      album: track.album.id,
      artists: track.artists.map((artist) => artist.id),
    });
    if (!albums.has(track.album.id)) {
      albums.set(track.album.id, {
        ...track.album,
        artists: (track.album.artists ?? []).map((artist) => artist.id),
      } as Album);
    }
    for (const artist of [
      ...(track.artists ?? []),
      ...(track.album.artists ?? []),
    ] as Artist[]) {
      if (artist?.id && !artists.has(artist.id)) {
        artists.set(artist.id, { ...artist });
      }
    }
  }

  for (const album of albums.values()) {
    await AlbumModel.updateOne(
      { id: album.id },
      { $setOnInsert: album },
      { upsert: true },
    ).catch(() => undefined);
  }
  for (const artist of artists.values()) {
    await ArtistModel.updateOne(
      { id: artist.id },
      { $setOnInsert: artist },
      { upsert: true },
    ).catch(() => undefined);
  }
  for (const track of flatTracks) {
    await TrackModel.updateOne(
      { id: track.id },
      { $setOnInsert: track },
      { upsert: true },
    ).catch(() => undefined);
  }
}
