import { AlbumModel, ArtistModel, InfosModel } from "../database/Models";
import {
  classifyChildrensMusicArtist,
  hasChildrensMusicAlbumName,
} from "../tools/classification/childrensMusic";
import { logger } from "../tools/logger";

/**
 * Retroactive content classification.
 *
 * Plays recorded before this feature existed carry no classification, so this
 * pass tags them using the same rules applied at ingestion. It is safe to run
 * repeatedly: it only adds missing reasons and never removes the manual artist
 * blacklist or deletes any play.
 */

interface BackfillResult {
  scanned: number;
  classified: number;
  childrensMusic: number;
  albumsFromAlbumSignal: number;
}

export async function backfillContentClassification(): Promise<BackfillResult> {
  const artists = await ArtistModel.find({
    $or: [{ genres: { $exists: true } }, { name: { $exists: true } }],
  }).lean();
  const artistById = new Map(artists.map((artist) => [artist.id, artist]));

  const albums = await AlbumModel.find({}, { id: 1, name: 1 }).lean();
  const albumNameById = new Map(albums.map((album) => [album.id, album.name]));

  // Only touch plays that are not already classified as children's content.
  const cursor = InfosModel.find({
    $or: [
      { blacklistedBy: { $exists: false } },
      { blacklistedBy: { $nin: ["childrens-music"] } },
    ],
  })
    .select({ _id: 1, primaryArtistId: 1, albumId: 1, blacklistedBy: 1 })
    .cursor();

  const result: BackfillResult = {
    scanned: 0,
    classified: 0,
    childrensMusic: 0,
    albumsFromAlbumSignal: 0,
  };

  let batch: {
    id: unknown;
    addChildrens: boolean;
    viaAlbum: boolean;
    existing: string[];
  }[] = [];

  const flush = async () => {
    if (batch.length === 0) {
      return;
    }
    const operations = batch.map((entry) => ({
      updateOne: {
        filter: { _id: entry.id },
        update: { $addToSet: { blacklistedBy: "childrens-music" as const } },
      },
    }));
    await InfosModel.bulkWrite(operations, { ordered: false });
    result.classified += batch.length;
    result.childrensMusic += batch.length;
    result.albumsFromAlbumSignal += batch.filter((e) => e.viaAlbum).length;
    batch = [];
  };

  for await (const info of cursor) {
    result.scanned += 1;
    const artist = artistById.get(info.primaryArtistId);
    const albumName = albumNameById.get(info.albumId);
    const artistSignal = classifyChildrensMusicArtist({
      name: artist?.name,
      genres: artist?.genres,
    });
    const viaAlbum =
      artistSignal === null && hasChildrensMusicAlbumName(albumName);
    if (!artistSignal && !viaAlbum) {
      continue;
    }
    batch.push({
      id: info._id,
      addChildrens: true,
      viaAlbum,
      existing: (info.blacklistedBy ?? []) as string[],
    });
    if (batch.length >= 500) {
      await flush();
    }
  }
  await flush();

  return result;
}

/**
 * Reports plays that reference an id with no stored track document. These are
 * the only shape a podcast episode could take in existing data, because both
 * importers have always required real track metadata and Spotify's
 * recently-played endpoint does not return episodes.
 */
export async function countPlaysWithoutTrack(): Promise<number> {
  const rows = await InfosModel.aggregate<{ count: number }>([
    {
      $lookup: {
        from: "tracks",
        localField: "id",
        foreignField: "id",
        as: "track",
      },
    },
    { $match: { track: { $size: 0 } } },
    { $count: "count" },
  ]);
  return rows[0]?.count ?? 0;
}
