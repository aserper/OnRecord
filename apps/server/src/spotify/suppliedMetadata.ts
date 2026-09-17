import { Album } from "../database/schemas/album";
import { SpotifyTrack } from "../database/schemas/track";
import { uniqBy } from "../tools/misc";

/**
 * Recently-played responses already include enough album data for normal UI
 * rendering. Persist it directly so recording a play never depends on another
 * Spotify catalog request.
 */
export function albumsFromSuppliedTracks(
  tracks: SpotifyTrack[],
  includeIds?: ReadonlySet<string>,
): Album[] {
  return uniqBy(
    tracks
      .filter(
        (track) => !includeIds || includeIds.has(track.album.id.toString()),
      )
      .map((track) => ({
        ...track.album,
        artists: track.album.artists.map((artist) => artist.id),
      })),
    (album) => album.id,
  );
}
