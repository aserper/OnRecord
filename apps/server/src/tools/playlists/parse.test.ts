import assert from "node:assert/strict";
import test from "node:test";

import { extractPlaylistId } from "./parse";

test("parses an open.spotify.com playlist URL", () => {
  assert.equal(
    extractPlaylistId(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123",
    ),
    "37i9dQZF1DXcBWIGoYBM5M",
  );
});

test("parses a URL with a trailing slash and extra segments", () => {
  assert.equal(
    extractPlaylistId(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M/",
    ),
    "37i9dQZF1DXcBWIGoYBM5M",
  );
});

test("parses a Spotify URI", () => {
  assert.equal(
    extractPlaylistId("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"),
    "37i9dQZF1DXcBWIGoYBM5M",
  );
});

test("accepts a bare playlist id", () => {
  assert.equal(
    extractPlaylistId("37i9dQZF1DXcBWIGoYBM5M"),
    "37i9dQZF1DXcBWIGoYBM5M",
  );
});

test("ignores surrounding whitespace", () => {
  assert.equal(
    extractPlaylistId("  spotify:playlist:37i9dQZF1DXcBWIGoYBM5M  "),
    "37i9dQZF1DXcBWIGoYBM5M",
  );
});

test("rejects a track URL", () => {
  assert.equal(
    extractPlaylistId("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"),
    null,
  );
});

test("rejects a URL without a playlist segment", () => {
  assert.equal(extractPlaylistId("https://open.spotify.com/"), null);
});

test("rejects a malformed id", () => {
  assert.equal(
    extractPlaylistId("https://open.spotify.com/playlist/tooshort"),
    null,
  );
});

test("rejects random text and empty input", () => {
  assert.equal(extractPlaylistId("not a playlist"), null);
  assert.equal(extractPlaylistId(""), null);
});

test("rejects a playlist URI with a wrong entity type", () => {
  assert.equal(extractPlaylistId("spotify:album:37i9dQZF1DXcBWIGoYBM5M"), null);
});
