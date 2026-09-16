import { TrackedPlaylistModel } from "../database/Models";
import {
  PlaylistChange,
  PlaylistTrackChangeItem,
  TrackedPlaylist,
} from "../database/schemas/trackedPlaylist";
import { HttpError } from "../tools/apis/queueHttpClient";
import { SpotifyAPI } from "../tools/apis/spotifyApi";
import { logger } from "../tools/logger";
import {
  computePlaylistDiff,
  enrichRemoved,
  PlaylistTrackSnapshot,
} from "../tools/playlists/diff";

export const PLAYLIST_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const LOOP_WAIT_MS = 60 * 1000;

export class PlaylistUnavailableError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fetchPlaylistSnapshot(
  api: SpotifyAPI,
  spotifyId: string,
): Promise<{
  name: string;
  imageUrl?: string;
  trackCount: number;
  tracks: PlaylistTrackSnapshot[];
}> {
  const meta = await api.getPlaylistMeta(spotifyId);
  const rawTracks = await api.getPlaylistTracks(spotifyId);
  const known = new Map<string, PlaylistTrackSnapshot>();
  const tracks: PlaylistTrackSnapshot[] = rawTracks
    .filter((track) => {
      if (known.has(track.id)) {
        return false;
      }
      known.set(track.id, {
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist) => artist.name),
      });
      return true;
    })
    .map((track) => known.get(track.id)!);

  return {
    name: meta.name,
    imageUrl: meta.images?.[0]?.url,
    trackCount: meta.tracks?.total ?? tracks.length,
    tracks,
  };
}

/**
 * Checks one tracked playlist once. Persists a change event when the track
 * set differs from the stored snapshot, and stamps lastCheckedAt only on a
 * successful check so failures retry on the next pass.
 */
export async function checkTrackedPlaylist(
  doc: TrackedPlaylist,
  api: SpotifyAPI,
): Promise<TrackedPlaylist | null> {
  try {
    const snapshot = await fetchPlaylistSnapshot(api, doc.spotifyId);
    const diff = computePlaylistDiff(doc.trackIds ?? [], snapshot.tracks);

    const lastCheckedAt = new Date();
    if (!diff.hasChanged) {
      const updated = await TrackedPlaylistModel.findOneAndUpdate(
        { _id: doc._id },
        {
          $set: {
            name: snapshot.name,
            imageUrl: snapshot.imageUrl,
            trackCount: snapshot.trackCount,
            trackIds: diff.trackIds,
            lastCheckedAt,
            lastError: undefined,
          },
          $unset: { lastError: 1 },
        },
        { new: true },
      );
      return updated ?? null;
    }

    const knownTracks: Record<string, PlaylistTrackSnapshot> = {};
    for (const id of doc.trackIds ?? []) {
      knownTracks[id] = { id, name: "", artists: [] };
    }
    for (const track of snapshot.tracks) {
      knownTracks[track.id] = track;
    }
    const removed: PlaylistTrackChangeItem[] = enrichRemoved(
      diff.removed,
      knownTracks,
    );
    const change: PlaylistChange = {
      detectedAt: lastCheckedAt,
      added: diff.added,
      removed,
    };

    const updated = await TrackedPlaylistModel.findOneAndUpdate(
      { _id: doc._id },
      {
        $set: {
          name: snapshot.name,
          imageUrl: snapshot.imageUrl,
          trackCount: snapshot.trackCount,
          trackIds: diff.trackIds,
          lastCheckedAt,
          lastChangedAt: lastCheckedAt,
          lastError: undefined,
        },
        $push: { changes: { $each: [change], $slice: -50 } },
        $unset: { lastError: 1 },
      },
      { new: true },
    );
    logger.info(
      `[playlist-tracker] "${snapshot.name}": ${diff.added.length} added, ${removed.length} removed`,
    );
    return updated ?? null;
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 404 || error.status === 403)
    ) {
      const message =
        error.status === 404
          ? "Playlist not found or no longer available."
          : "This playlist is private. Reconnect your Spotify account to allow playlist reading.";
      await TrackedPlaylistModel.updateOne(
        { _id: doc._id },
        { $set: { lastError: message } },
      );
      return null;
    }
    // Rate limits and transient failures: leave lastCheckedAt untouched so
    // the playlist is retried on the next pass.
    throw error;
  }
}

export async function runDuePlaylistChecks(now = new Date()): Promise<void> {
  const due = await TrackedPlaylistModel.find({
    $or: [
      { lastCheckedAt: { $exists: false } },
      { lastCheckedAt: null },
      {
        lastCheckedAt: {
          $lt: new Date(now.getTime() - PLAYLIST_CHECK_INTERVAL_MS),
        },
      },
    ],
  }).limit(100);

  if (due.length === 0) {
    return;
  }
  const apis = new Map<string, SpotifyAPI>();
  for (const doc of due) {
    const ownerId = doc.owner.toString();
    let api = apis.get(ownerId);
    if (!api) {
      api = new SpotifyAPI(ownerId);
      apis.set(ownerId, api);
    }
    try {
      await checkTrackedPlaylist(doc, api);
    } catch (error) {
      logger.error(
        `[playlist-tracker] check failed for "${doc.name}"`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

let timer: NodeJS.Timeout | undefined;
let running = false;

export function startPlaylistTracker() {
  if (timer) {
    return;
  }
  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await runDuePlaylistChecks();
    } catch (error) {
      logger.error("[playlist-tracker] pass failed", error);
    } finally {
      running = false;
    }
  };
  void tick();
  timer = setInterval(() => void tick(), LOOP_WAIT_MS);
  timer.unref();
}
