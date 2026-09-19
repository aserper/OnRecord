import assert from "node:assert/strict";
import test from "node:test";

import {
  isPodcastApiObject,
  isPodcastHistoryRecord,
  isPodcastType,
  isPodcastUri,
  isUnresolvableHistoryRecord,
} from "./podcasts";

test("recognizes podcast, show, audiobook and chapter URIs", () => {
  for (const uri of [
    "spotify:episode:512ojhOuo1ktJprKbVcKyQ",
    "spotify:show:6kAsbP8pxwaU2kPibKTuHE",
    "spotify:audiobook:7iHfbu1YPACw6oZPAFJtqe",
    "spotify:chapter:0D5wENdkdwbqlrHoaJ9g29",
  ]) {
    assert.equal(isPodcastUri(uri), true, `expected ${uri} to be a podcast`);
  }
});

test("does not treat music or playlist URIs as podcasts", () => {
  for (const uri of [
    "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
    "spotify:album:6N9PS4QXF1D0OWPk0Sxtb4",
    "spotify:artist:0gxyHStUsqpMadRV0Di1Qt",
    "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
    "",
    undefined,
    null,
  ]) {
    assert.equal(isPodcastUri(uri), false);
  }
});

test("detects episode objects returned by the Web API", () => {
  assert.equal(isPodcastApiObject({ type: "episode" }), true);
  assert.equal(isPodcastApiObject({ type: "audiobook" }), true);
  assert.equal(isPodcastApiObject({ type: "track" }), false);
  assert.equal(isPodcastApiObject({}), false);
  assert.equal(isPodcastType("EPISODE"), true);
  assert.equal(isPodcastType("track"), false);
});

test("detects podcast rows in extended streaming history", () => {
  // Real shape of a podcast row in the export.
  assert.equal(
    isPodcastHistoryRecord({
      spotify_track_uri: null,
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      episode_name: "Episode 12: The Thing",
      episode_show_name: "Some Podcast",
      spotify_episode_uri: "spotify:episode:512ojhOuo1ktJprKbVcKyQ",
    }),
    true,
  );
  assert.equal(
    isPodcastHistoryRecord({
      episode_name: "An episode",
      spotify_episode_uri: "spotify:episode:512ojhOuo1ktJprKbVcKyQ",
    }),
    true,
  );
});

test("does not treat music rows as podcasts", () => {
  assert.equal(
    isPodcastHistoryRecord({
      spotify_track_uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
      master_metadata_track_name: "Never Gonna Give You Up",
      master_metadata_album_artist_name: "Rick Astley",
    }),
    false,
  );
  // Stray episode fields must not override an explicit music track.
  assert.equal(
    isPodcastHistoryRecord({
      spotify_track_uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
      master_metadata_track_name: "A Song",
      episode_name: "leftover",
    }),
    false,
  );
});

test("identifies records that can never resolve to a music track", () => {
  // This is the upstream bug #582 case: audiobook rows with no track name.
  assert.equal(
    isUnresolvableHistoryRecord({ audiobook_title: "Some Audiobook" }),
    true,
  );
  assert.equal(
    isUnresolvableHistoryRecord({
      spotify_track_uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
      master_metadata_track_name: "A Song",
      master_metadata_album_artist_name: "An Artist",
    }),
    false,
  );
});
