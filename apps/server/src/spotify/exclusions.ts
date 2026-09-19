import { ArtistModel } from "../database/Models";
import { ExcludedBy } from "../database/schemas/info";
import { SpotifyTrack } from "../database/schemas/track";
import { User } from "../database/schemas/user";
import {
  classifyChildrensMusic,
  ChildrensMusicSignal,
} from "../tools/classification/childrensMusic";

/**
 * Content classification applied when a play is recorded.
 *
 * A play is tagged with every reason that applies, independently of the user's
 * current filters. Statistics then hide a tag only when the matching setting is
 * enabled, so toggling a filter is instant and fully reversible and no data is
 * ever deleted.
 */

export interface PlayClassificationInput {
  artistId?: string | undefined;
  artistName?: string | undefined;
  artistGenres?: readonly string[] | undefined;
  albumName?: string | undefined;
}

/** Returns the exclusion reasons that apply to one play. */
export function classifyPlay(input: PlayClassificationInput): ExcludedBy[] {
  const reasons: ExcludedBy[] = [];
  const childrens = classifyChildrensMusic({
    artistName: input.artistName,
    artistGenres: input.artistGenres,
    albumName: input.albumName,
  });
  if (childrens) {
    reasons.push("childrens-music");
  }
  return reasons;
}

/** Human-readable explanation of a children's-music signal, for review UIs. */
export function describeChildrensSignal(signal: ChildrensMusicSignal): string {
  switch (signal) {
    case "genre":
      return "Spotify genre";
    case "artist":
      return "Known children's artist";
    case "album":
      return "Children's album";
    default:
      return "Not classified";
  }
}

/**
 * Full exclusion reasons for a play, including the manual artist blacklist.
 * Returns a partial object so callers can spread it into an `infos` document.
 */
export function exclusionReasons(
  user: Pick<User, "settings">,
  input: PlayClassificationInput & { trackId?: string },
): { blacklistedBy?: ExcludedBy[] } {
  const reasons = classifyPlay(input);
  if (
    input.artistId &&
    user.settings?.blacklistedArtists?.includes(input.artistId)
  ) {
    reasons.push("artist");
  }
  return reasons.length > 0 ? { blacklistedBy: reasons } : {};
}

/**
 * Classifies a batch of supplied plays using the artist metadata already
 * stored in MongoDB.
 *
 * Spotify's track lookups return only simplified artists, which carry no
 * genre list, and enrichment only fetches genre data for artists that are
 * missing locally. Reading the stored artist documents therefore gives the
 * richest available signal without any extra Spotify request.
 */
export async function classifySuppliedPlays(
  items: { track: SpotifyTrack }[],
): Promise<ExcludedBy[][]> {
  const artistIds = [
    ...new Set(items.flatMap((item) => item.track.artists.map((a) => a.id))),
  ];
  if (artistIds.length === 0) {
    return items.map(() => []);
  }
  const storedArtists = await ArtistModel.find({
    id: { $in: artistIds },
  }).lean();
  const storedById = new Map(
    storedArtists.map((artist) => [artist.id, artist]),
  );

  return items.map((item) => {
    const [primary] = item.track.artists;
    const stored = primary ? storedById.get(primary.id) : undefined;
    return classifyPlay({
      artistId: primary?.id,
      artistName: stored?.name ?? primary?.name,
      artistGenres: stored?.genres,
      albumName: item.track.album?.name,
    });
  });
}
