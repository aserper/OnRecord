/**
 * Podcast/audiobook detection.
 *
 * Unlike children's music, this is structural rather than heuristic, and it
 * uses the shapes Spotify itself defines:
 *
 * - Spotify separates the two content types by URI namespace:
 *   `spotify:track:<id>` (music) vs `spotify:episode:<id>` (podcasts/shows).
 *   Audiobooks use `spotify:audiobook:` / `spotify:chapter:`.
 * - Extended streaming history exports carry podcast rows with
 *   `episode_name` / `episode_show_name` / `spotify_episode_uri` set and
 *   `master_metadata_track_name` / `spotify_track_uri` null.
 * - The Web API marks each object with a `type` field: `"track"` vs
 *   `"episode"`. Playlist results must be checked against it because Spotify
 *   maps episodes onto the track shape for backwards compatibility unless
 *   `additional_types` is passed.
 */

const PODCAST_URI_PATTERN =
  /^spotify:(episode|show|audiobook|chapter):[0-9A-Za-z]+$/;

/** Contents of a raw extended-history record relevant to classification. */
export interface HistoryRecordShape {
  spotify_track_uri?: unknown;
  spotify_episode_uri?: unknown;
  episode_name?: unknown;
  episode_show_name?: unknown;
  audiobook_title?: unknown;
  audiobook_uri?: unknown;
  master_metadata_track_name?: unknown;
  master_metadata_album_artist_name?: unknown;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** True when a Spotify URI points at a podcast, show, audiobook or chapter. */
export function isPodcastUri(uri: string | undefined | null): boolean {
  return typeof uri === "string" && PODCAST_URI_PATTERN.test(uri.trim());
}

/** True when a Web API object is an episode rather than a music track. */
export function isPodcastType(type: string | undefined | null): boolean {
  return typeof type === "string" && type.toLowerCase() !== "track" && type
    ? ["episode", "show", "audiobook", "chapter"].includes(type.toLowerCase())
    : false;
}

export function isPodcastApiObject(item: {
  type?: unknown;
  is_local?: unknown;
}): boolean {
  return typeof item.type === "string"
    ? ["episode", "show", "audiobook", "chapter"].includes(
        item.type.toLowerCase(),
      )
    : false;
}

/**
 * Detects podcast rows in an extended streaming history record.
 *
 * A record is a podcast when it names an episode/audiobook, when it carries a
 * podcast URI, or when it has episode metadata but no music track metadata.
 * Records that explicitly identify a music track are never treated as
 * podcasts even if stray episode fields are present.
 */
export function isPodcastHistoryRecord(record: HistoryRecordShape): boolean {
  if (
    isPodcastUri(
      typeof record.spotify_episode_uri === "string"
        ? record.spotify_episode_uri
        : undefined,
    )
  ) {
    return true;
  }
  if (
    isPodcastUri(
      typeof record.audiobook_uri === "string"
        ? record.audiobook_uri
        : undefined,
    )
  ) {
    return true;
  }
  const hasMusicTrack =
    isNonEmptyString(record.spotify_track_uri) &&
    isNonEmptyString(record.master_metadata_track_name);
  if (hasMusicTrack) {
    return false;
  }
  return (
    isNonEmptyString(record.episode_name) ||
    isNonEmptyString(record.episode_show_name) ||
    isNonEmptyString(record.audiobook_title)
  );
}

/**
 * True when a history record can never be resolved to a music track: no track
 * name and no music URI. These are the rows that previously aborted imports.
 */
export function isUnresolvableHistoryRecord(
  record: HistoryRecordShape,
): boolean {
  return (
    !isNonEmptyString(record.spotify_track_uri) ||
    !isNonEmptyString(record.master_metadata_track_name) ||
    !isNonEmptyString(record.master_metadata_album_artist_name)
  );
}
