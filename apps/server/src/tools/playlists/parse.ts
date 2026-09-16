const PLAYLIST_ID_PATTERN = /^[0-9A-Za-z]{22}$/;

/**
 * Extracts a Spotify playlist id from a playlist URL, a Spotify URI, or a
 * bare id. Returns null for anything else.
 *
 * Accepted shapes:
 *   https://open.spotify.com/playlist/<id>?si=...
 *   https://open.spotify.com/playlist/<id>/  (trailing slash, extra segments)
 *   spotify:playlist:<id>
 *   <id>
 */
export function extractPlaylistId(input: string): string | null {
  const value = input.trim();
  if (value.length === 0) {
    return null;
  }

  const uriMatch = /^spotify:playlist:([0-9A-Za-z]+)$/.exec(value);
  if (uriMatch?.[1]) {
    return sanitizeId(uriMatch[1]);
  }

  if (PLAYLIST_ID_PATTERN.test(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const playlistIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === "playlist",
  );
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (playlistIndex === -1) {
    return null;
  }
  return sanitizeId(segments[playlistIndex + 1] ?? "");
}

function sanitizeId(candidate: string): string | null {
  return PLAYLIST_ID_PATTERN.test(candidate) ? candidate : null;
}
