import assert from "node:assert/strict";
import test from "node:test";

import {
  capChanges,
  computePlaylistDiff,
  enrichRemoved,
  PlaylistTrackSnapshot,
} from "./diff";

const track = (id: string, name = `Track ${id}`): PlaylistTrackSnapshot => ({
  id,
  name,
  artists: [`Artist of ${id}`],
});

test("reports added tracks with their metadata", () => {
  const diff = computePlaylistDiff([], [track("a"), track("b")]);
  assert.deepEqual(
    diff.added.map((item) => item.id),
    ["a", "b"],
  );
  assert.deepEqual(diff.added[0], {
    id: "a",
    name: "Track a",
    artists: ["Artist of a"],
  });
  assert.equal(diff.removed.length, 0);
  assert.equal(diff.hasChanged, true);
});

test("reports removed tracks", () => {
  const diff = computePlaylistDiff(["a", "b"], [track("a")]);
  assert.deepEqual(
    diff.removed.map((item) => item.id),
    ["b"],
  );
  assert.equal(diff.added.length, 0);
  assert.equal(diff.hasChanged, true);
});

test("reports a mixed change", () => {
  const diff = computePlaylistDiff(["a", "b"], [track("b"), track("c")]);
  assert.deepEqual(
    diff.added.map((item) => item.id),
    ["c"],
  );
  assert.deepEqual(
    diff.removed.map((item) => item.id),
    ["a"],
  );
});

test("ignores pure reorders", () => {
  const diff = computePlaylistDiff(
    ["a", "b", "c"],
    [track("c"), track("a"), track("b")],
  );
  assert.equal(diff.hasChanged, false);
  assert.deepEqual(diff.trackIds, ["c", "a", "b"]);
});

test("ignores a duplicate copy of an already-present track", () => {
  const diff = computePlaylistDiff(["a"], [track("a"), track("a")]);
  assert.equal(diff.hasChanged, false);
  assert.deepEqual(diff.trackIds, ["a"]);
});

test("collapses duplicates in the incoming playlist", () => {
  const diff = computePlaylistDiff([], [track("a"), track("a"), track("b")]);
  assert.deepEqual(diff.trackIds, ["a", "b"]);
  assert.deepEqual(
    diff.added.map((item) => item.id),
    ["a", "b"],
  );
});

test("reports each removed duplicate only once", () => {
  const diff = computePlaylistDiff(["a", "a", "b"], [track("b")]);
  assert.deepEqual(
    diff.removed.map((item) => item.id),
    ["a"],
  );
});

test("enrichRemoved restores names from known metadata", () => {
  const enriched = enrichRemoved([{ id: "a", name: "", artists: [] }], {
    a: track("a"),
  });
  assert.deepEqual(enriched, [
    { id: "a", name: "Track a", artists: ["Artist of a"] },
  ]);
});

test("enrichRemoved keeps placeholders for unknown tracks", () => {
  const enriched = enrichRemoved([{ id: "zzz", name: "", artists: [] }], {});
  assert.deepEqual(enriched, [{ id: "zzz", name: "", artists: [] }]);
});

test("capChanges keeps the newest entries, oldest first", () => {
  const existing = [
    { detectedAt: new Date(1), added: [], removed: [] },
    { detectedAt: new Date(2), added: [], removed: [] },
  ];
  const next = { detectedAt: new Date(3), added: [], removed: [] };
  const capped = capChanges(existing, next, 2);
  assert.deepEqual(
    capped.map((change) => change.detectedAt.getTime()),
    [2, 3],
  );
});

test("capChanges defaults to the schema cap", () => {
  const existing = Array.from({ length: 60 }, (_, index) => ({
    detectedAt: new Date(index),
    added: [],
    removed: [],
  }));
  const capped = capChanges(existing, {
    detectedAt: new Date(1000),
    added: [],
    removed: [],
  });
  assert.equal(capped.length, 50);
});
