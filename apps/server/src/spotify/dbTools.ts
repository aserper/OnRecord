import mongoose from "mongoose";

import {
  addTrackIdsToUser,
  storeInUser,
  storeFirstListenedAtIfLess,
} from "../database";
import { TrackModel, AlbumModel, ArtistModel } from "../database/Models";
import { Album } from "../database/schemas/album";
import { Artist } from "../database/schemas/artist";
import { Infos } from "../database/schemas/info";
import { SpotifyTrack, Track } from "../database/schemas/track";
import { SpotifyAPI } from "../tools/apis/spotifyApi";
import { longWriteDbLock } from "../tools/lock";
import { logger } from "../tools/logger";
import { Metrics } from "../tools/metrics";
import { minOfArray, uniqBy } from "../tools/misc";
import { compact } from "../tools/utils";
import { albumsFromSuppliedTracks } from "./suppliedMetadata";

export const getTracks = async (
  userId: string,
  ids: string[],
  suppliedTracks?: SpotifyTrack[],
) => {
  const client = new SpotifyAPI(userId);
  const uniqueIds = [...new Set(ids)];
  const tracksById = new Map(
    (suppliedTracks ?? []).map((track) => [track.id, track]),
  );
  const missingIds = uniqueIds.filter((id) => !tracksById.has(id));
  if (missingIds.length > 0) {
    const fetchedTracks = compact(await client.getTracksBatched(missingIds));
    fetchedTracks.forEach((track) => tracksById.set(track.id, track));
  }
  const spotifyTracks = compact(uniqueIds.map((id) => tracksById.get(id)));

  const tracks = spotifyTracks.map<Track>((track) => {
    logger.info(
      `Storing non existing track ${track.name} by ${track.artists[0]?.name}`,
    );
    return {
      ...track,
      album: track.album.id,
      artists: track.artists.map((e) => e.id),
    };
  });
  Metrics.ingestedTracksTotal.inc({ user: userId }, tracks.length);

  return tracks;
};

/**
 * Builds missing track and album records entirely from a recently-played
 * payload. This path intentionally performs no Spotify catalog requests.
 */
export const getTracksAlbumsFromSupplied = async (
  userId: string,
  spotifyTracks: SpotifyTrack[],
) => {
  const trackIds = [...new Set(spotifyTracks.map((track) => track.id))];
  const storedTracks: Track[] = await TrackModel.find({
    id: { $in: trackIds },
  });
  const storedTrackIds = new Set(storedTracks.map((track) => track.id));
  const missingTrackIds = trackIds.filter((id) => !storedTrackIds.has(id));
  const tracks =
    missingTrackIds.length > 0
      ? await getTracks(userId, missingTrackIds, spotifyTracks)
      : [];

  const albumIds = [
    ...new Set(spotifyTracks.map((track) => track.album.id.toString())),
  ];
  const storedAlbums: Album[] = await AlbumModel.find({
    id: { $in: albumIds },
  });
  const storedAlbumIds = new Set(storedAlbums.map((album) => album.id));
  const missingAlbumIds = new Set(
    albumIds.filter((id) => !storedAlbumIds.has(id)),
  );
  const albums = albumsFromSuppliedTracks(spotifyTracks, missingAlbumIds);
  Metrics.ingestedAlbumsTotal.inc({ user: userId }, albums.length);

  return { tracks, albums };
};

export const getAlbums = async (userId: string, ids: string[]) => {
  const client = new SpotifyAPI(userId);
  const spotifyAlbums = compact(await client.getAlbumsBatched(ids));

  const albums: Album[] = spotifyAlbums.map((alb) => {
    logger.info(
      `Storing non existing album ${alb.name} by ${alb.artists[0]?.name}`,
    );

    return { ...alb, artists: alb.artists.map((art) => art.id) };
  });
  Metrics.ingestedAlbumsTotal.inc({ user: userId }, albums.length);

  return albums;
};

export const getArtists = async (userId: string, ids: string[]) => {
  const client = new SpotifyAPI(userId);
  const spotifyArtists = compact(await client.getArtistsBatched(ids));

  for (const spotifyArtist of spotifyArtists) {
    logger.info(`Storing non existing artist ${spotifyArtist.name}`);
  }

  Metrics.ingestedArtistsTotal.inc({ user: userId }, spotifyArtists.length);

  return spotifyArtists;
};

const getTracksAndRelatedAlbumArtists = async (
  userId: string,
  ids: string[],
  suppliedTracks?: SpotifyTrack[],
) => {
  const tracks = await getTracks(userId, ids, suppliedTracks);

  return {
    tracks,
    artists: [...new Set(tracks.flatMap((e) => e.artists)).values()],
    albums: [...new Set(tracks.map((e) => e.album)).values()],
  };
};

export const getTracksAlbumsArtists = async (
  userId: string,
  spotifyTracks: SpotifyTrack[],
) => {
  const ids = [...new Set(spotifyTracks.map((track) => track.id))];
  const storedTracks: Track[] = await TrackModel.find({ id: { $in: ids } });
  const missingTrackIds = ids.filter(
    (id) =>
      !storedTracks.find((stored) => stored.id.toString() === id.toString()),
  );

  if (missingTrackIds.length === 0) {
    logger.info("No missing tracks, passing...");
    return { tracks: [], albums: [], artists: [] };
  }

  const {
    tracks,
    artists: relatedArtists,
    albums: relatedAlbums,
  } = await getTracksAndRelatedAlbumArtists(
    userId,
    missingTrackIds,
    missingTrackIds.flatMap((id) => {
      const track = spotifyTracks.find((item) => item.id === id);
      return track ? [track] : [];
    }),
  );

  const storedAlbums: Album[] = await AlbumModel.find({
    id: { $in: relatedAlbums },
  });
  const missingAlbumIds = relatedAlbums.filter(
    (alb) =>
      !storedAlbums.find((salb) => salb.id.toString() === alb.toString()),
  );

  const storedArtists: Artist[] = await ArtistModel.find({
    id: { $in: relatedArtists },
  });
  const missingArtistIds = relatedArtists.filter(
    (alb) =>
      !storedArtists.find((salb) => salb.id.toString() === alb.toString()),
  );

  const albums =
    missingAlbumIds.length > 0 ? await getAlbums(userId, missingAlbumIds) : [];
  const artists =
    missingArtistIds.length > 0
      ? await getArtists(userId, missingArtistIds)
      : [];

  return { tracks, albums, artists };
};

export async function storeTrackAlbumArtist({
  tracks,
  albums,
  artists,
}: {
  tracks?: Track[];
  albums?: Album[];
  artists?: Artist[];
}) {
  if (tracks) {
    await TrackModel.create(uniqBy(tracks, (item) => item.id));
  }
  if (albums) {
    await AlbumModel.create(uniqBy(albums, (item) => item.id));
  }
  if (artists) {
    await ArtistModel.create(uniqBy(artists, (item) => item.id));
  }
}

export async function storeIterationOfLoop(
  userId: string,
  iterationTimestamp: number,
  tracks: Track[],
  albums: Album[],
  artists: Artist[],
  infos: Omit<Infos, "owner">[],
) {
  await longWriteDbLock.lock();
  try {
    await storeTrackAlbumArtist({ tracks, albums, artists });

    await addTrackIdsToUser(userId, infos);

    await storeInUser("_id", new mongoose.Types.ObjectId(userId), {
      lastTimestamp: iterationTimestamp,
    });

    const min = minOfArray(infos, (item) => item.played_at.getTime());

    if (min) {
      const minInfo = infos[min.minIndex]?.played_at;
      if (minInfo) {
        await storeFirstListenedAtIfLess(userId, minInfo);
      }
    }
  } finally {
    longWriteDbLock.unlock();
  }
}
