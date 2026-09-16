import assert from "node:assert/strict";
import test from "node:test";

import { batchedLookup, SPOTIFY_BATCH_SIZES } from "./batchedLookup";

test("returns an empty array without calling the fetcher", async () => {
  let calls = 0;
  const result = await batchedLookup([], 50, async () => {
    calls += 1;
    return [];
  });
  assert.deepEqual(result, []);
  assert.equal(calls, 0);
});

test("splits ids into pages of the requested size", async () => {
  const pages: string[][] = [];
  const ids = Array.from({ length: 120 }, (_, index) => `id${index}`);
  const result = await batchedLookup(ids, 50, async (page) => {
    pages.push(page);
    return page.map((id) => ({ id }));
  });

  assert.deepEqual(pages.length, 3);
  assert.deepEqual(pages[0]!.length, 50);
  assert.deepEqual(pages[1]!.length, 50);
  assert.deepEqual(pages[2]!.length, 20);
  assert.equal(result.length, 120);
});

test("concatenates page results in request order", async () => {
  const ids = ["a", "b", "c", "d"];
  const result = await batchedLookup(ids, 2, async (page) =>
    page.map((id) => `result-${id}`),
  );
  assert.deepEqual(result, ["result-a", "result-b", "result-c", "result-d"]);
});

test("propagates fetch errors", async () => {
  await assert.rejects(
    () =>
      batchedLookup(["a", "b"], 1, async () => {
        throw new Error("boom");
      }),
    /boom/,
  );
});

test("batch sizes respect Spotify lookup limits", () => {
  assert.equal(SPOTIFY_BATCH_SIZES.tracks, 50);
  assert.equal(SPOTIFY_BATCH_SIZES.albums, 20);
  assert.equal(SPOTIFY_BATCH_SIZES.artists, 50);
});
