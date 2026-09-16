import { Router } from "express";
import { z } from "zod";

import { TrackedPlaylistModel } from "../database/Models";
import {
  getTrackedPlaylistsForUser,
  removeTrackedPlaylist,
} from "../database/queries/trackedPlaylist";
import { checkTrackedPlaylist } from "../spotify/playlistTracker";
import { HttpError } from "../tools/apis/queueHttpClient";
import { SpotifyAPI } from "../tools/apis/spotifyApi";
import { logged, validate } from "../tools/middleware";
import { extractPlaylistId } from "../tools/playlists/parse";
import { LoggedRequest } from "../tools/types";

export const router = Router();

const trackSchema = z.object({ url: z.string().min(1).max(500) });

function serialize(doc: any) {
  return doc?.toJSON?.() ?? doc;
}

router.post("/track", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { url } = validate(req.body, trackSchema);

  const spotifyId = extractPlaylistId(url);
  if (!spotifyId) {
    res.status(400).send({ code: "INVALID_PLAYLIST_URL" });
    return;
  }

  const existing = await TrackedPlaylistModel.findOne({
    owner: user._id,
    spotifyId,
  });
  if (existing) {
    res.status(409).send({ code: "PLAYLIST_ALREADY_TRACKED" });
    return;
  }

  const api = new SpotifyAPI(user._id.toString());
  try {
    // Fetch immediately so an inaccessible playlist fails here, with a
    // clear reason, before anything is stored.
    const checked = await checkTrackedPlaylist(
      {
        _id: user._id,
        owner: user._id,
        spotifyId,
        name: "",
        trackCount: 0,
        trackIds: [],
        changes: [],
      } as any,
      api,
    );
    const stored = await TrackedPlaylistModel.findOneAndUpdate(
      { owner: user._id, spotifyId },
      {
        $set: {
          name: checked?.name ?? "",
          imageUrl: checked?.imageUrl,
          trackCount: checked?.trackCount ?? 0,
          trackIds: checked?.trackIds ?? [],
          lastCheckedAt: new Date(),
          lastError: undefined,
        },
      },
      { new: true, upsert: true },
    );
    res.status(201).send(serialize(stored));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      res.status(404).send({ code: "PLAYLIST_NOT_FOUND" });
      return;
    }
    if (error instanceof HttpError && error.status === 403) {
      res.status(403).send({ code: "PLAYLIST_FORBIDDEN" });
      return;
    }
    throw error;
  }
});

router.get("/tracked", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const playlists = await getTrackedPlaylistsForUser(user._id.toString());
  res.status(200).send(playlists.map(serialize));
});

router.delete("/tracked/:id", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const deleted = await removeTrackedPlaylist(
    user._id.toString(),
    req.params.id,
  );
  if (!deleted) {
    res.status(404).end();
    return;
  }
  res.status(204).end();
});

router.post("/tracked/:id/refresh", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const doc = await TrackedPlaylistModel.findOne({
    _id: req.params.id,
    owner: user._id,
  });
  if (!doc) {
    res.status(404).end();
    return;
  }
  const api = new SpotifyAPI(user._id.toString());
  try {
    await checkTrackedPlaylist(doc, api);
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 404 || error.status === 403)
    ) {
      const updated = await TrackedPlaylistModel.findById(doc._id);
      res.status(200).send(serialize(updated));
      return;
    }
    throw error;
  }
  const updated = await TrackedPlaylistModel.findById(doc._id);
  res.status(200).send(serialize(updated));
});
