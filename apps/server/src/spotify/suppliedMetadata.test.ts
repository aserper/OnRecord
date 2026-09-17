import assert from "node:assert/strict";
import test from "node:test";

import { SpotifyTrack } from "../database/schemas/track";
import { albumsFromSuppliedTracks } from "./suppliedMetadata";

const track = (trackId: string, albumId: string): SpotifyTrack =>
  ({
    id: trackId,
    name: trackId,
    album: {
      id: albumId,
      name: albumId,
      artists: [{ id: "artist-1", name: "Artist", genres: [], images: [] }],
      images: [{ url: "cover.jpg", width: 300, height: 300 }],
    },
  }) as unknown as SpotifyTrack;

test("builds displayable albums from recently-played track payloads", () => {
  const albums = albumsFromSuppliedTracks([track("track-1", "album-1")]);
  assert.equal(albums.length, 1);
  assert.equal(albums[0]!.id, "album-1");
  assert.deepEqual(albums[0]!.artists, ["artist-1"]);
  assert.equal(albums[0]!.images[0]!.url, "cover.jpg");
});

test("deduplicates albums and filters to missing ids", () => {
  const albums = albumsFromSuppliedTracks(
    [
      track("track-1", "album-1"),
      track("track-2", "album-1"),
      track("track-3", "album-2"),
    ],
    new Set(["album-2"]),
  );
  assert.deepEqual(
    albums.map(({ id }) => id),
    ["album-2"],
  );
});
