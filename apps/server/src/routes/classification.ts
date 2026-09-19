import { Router } from "express";
import { Types } from "mongoose";

import { ArtistModel, InfosModel } from "../database/Models";
import { classifyChildrensMusicArtist } from "../tools/classification/childrensMusic";
import { logger } from "../tools/logger";
import { logged } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

export const router = Router();

const toObjectId = (value: string) => new Types.ObjectId(value);

export interface ClassifiedChildrensArtist {
  id: string;
  name: string;
  genres: string[];
  /** Number of stored plays involving this artist. */
  plays: number;
  /** Why the artist is classified as children's music. */
  reason: "genre" | "artist" | "album";
  /** True when the play-level signal came from an album title. */
  viaAlbum: boolean;
}

/**
 * Lists the children's-music artists found in the user's own listening so the
 * classification can be reviewed instead of trusted blindly. Plays tagged via
 * an album title are reported separately, because those artists are not
 * inherently children's artists.
 */
router.get("/classification/childrens-music", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const owner = toObjectId(user._id.toString());

  const [artistGroups, albumGroups] = await Promise.all([
    InfosModel.aggregate<{ _id: string; plays: number }>([
      { $match: { owner, blacklistedBy: "childrens-music" } },
      { $group: { _id: "$primaryArtistId", plays: { $sum: 1 } } },
      { $sort: { plays: -1 } },
    ]).catch((error) => {
      logger.error("[classification] artist aggregation failed", error);
      return [] as { _id: string; plays: number }[];
    }),
    InfosModel.aggregate<{ _id: string; plays: number }>([
      { $match: { owner, blacklistedBy: "childrens-music" } },
      { $group: { _id: "$albumId", plays: { $sum: 1 } } },
    ]).catch(() => [] as { _id: string; plays: number }[]),
  ]);

  const artistIds = artistGroups.map((group) => group._id);
  const artists = await ArtistModel.find({ id: { $in: artistIds } }).lean();
  const artistById = new Map(artists.map((artist) => [artist.id, artist]));

  const items: ClassifiedChildrensArtist[] = artistGroups.map((group) => {
    const artist = artistById.get(group._id);
    const genres = artist?.genres ?? [];
    const name = artist?.name ?? "";
    const signal = classifyChildrensMusicArtist({ name, genres });
    return {
      id: group._id,
      name,
      genres,
      plays: group.plays,
      reason: signal ?? "album",
      viaAlbum: signal === null,
    };
  });

  res
    .status(200)
    .send({
      items,
      albumClassifiedPlays: albumGroups.reduce(
        (total, group) => total + group.plays,
        0,
      ),
    });
});

/** Counts of plays excluded for each reason, for the settings summary. */
router.get("/classification/summary", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const owner = toObjectId(user._id.toString());

  const rows = await InfosModel.aggregate<{ _id: string; plays: number }>([
    { $match: { owner, blacklistedBy: { $exists: true } } },
    { $unwind: "$blacklistedBy" },
    { $group: { _id: "$blacklistedBy", plays: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    counts[row._id] = row.plays;
  });
  res
    .status(200)
    .send({
      childrensMusic: counts["childrens-music"] ?? 0,
      podcasts: counts.podcast ?? 0,
      artists: counts.artist ?? 0,
    });
});
