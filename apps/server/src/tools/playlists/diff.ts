import {
  MAX_STORED_CHANGES,
  PlaylistChange,
  PlaylistTrackChangeItem,
} from "../../database/schemas/trackedPlaylist";

export interface PlaylistTrackSnapshot {
  id: string;
  name: string;
  artists: string[];
}

export interface PlaylistDiff {
  added: PlaylistTrackChangeItem[];
  removed: PlaylistTrackChangeItem[];
  /** Ordered unique track ids of the new state. */
  trackIds: string[];
  hasChanged: boolean;
}

/**
 * Compares two playlist states by unique track id. Pure reorders and
 * duplicate copies of an already-present track are not reported as changes;
 * Spotify playlists can contain the same track more than once, so diffing
 * collapses duplicates and ignores positions.
 */
export function computePlaylistDiff(
  previousIds: string[],
  nextTracks: PlaylistTrackSnapshot[],
): PlaylistDiff {
  const previous = new Set(previousIds);
  const seen = new Set<string>();
  const trackIds: string[] = [];
  const added: PlaylistTrackChangeItem[] = [];

  for (const track of nextTracks) {
    if (seen.has(track.id)) {
      continue;
    }
    seen.add(track.id);
    trackIds.push(track.id);
    if (!previous.has(track.id)) {
      added.push(toItem(track));
    }
  }

  const next = new Set(trackIds);
  const previousOrdered: string[] = [];
  const removed: PlaylistTrackChangeItem[] = [];
  const removedSeen = new Set<string>();
  for (const id of previousIds) {
    if (!previousOrdered.includes(id)) {
      previousOrdered.push(id);
    }
    if (next.has(id) || removedSeen.has(id)) {
      continue;
    }
    removedSeen.add(id);
    removed.push({ id, name: "", artists: [] });
  }

  return {
    added,
    removed,
    trackIds,
    hasChanged: added.length > 0 || removed.length > 0,
  };
}

/** Fills in names for removed tracks from the previous stored metadata. */
export function enrichRemoved(
  removed: PlaylistTrackChangeItem[],
  knownTracks: Record<string, PlaylistTrackSnapshot>,
): PlaylistTrackChangeItem[] {
  return removed.map((item) => {
    const known = knownTracks[item.id];
    return known
      ? { id: item.id, name: known.name, artists: known.artists }
      : item;
  });
}

export function toItem(track: PlaylistTrackSnapshot): PlaylistTrackChangeItem {
  return { id: track.id, name: track.name, artists: track.artists };
}

/** Keeps the newest `max` changes, oldest first. */
export function capChanges(
  existing: PlaylistChange[],
  next: PlaylistChange,
  max = MAX_STORED_CHANGES,
): PlaylistChange[] {
  return [...existing, next].slice(-max);
}
