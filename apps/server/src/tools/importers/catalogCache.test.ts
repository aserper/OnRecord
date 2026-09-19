import assert from "node:assert/strict";
import test from "node:test";

import {
  clearNegativeCache,
  markMissingFromSpotify,
  negativeCacheSize,
} from "./catalogCache";

test("negative lookups expire instead of blocking forever", () => {
  clearNegativeCache();
  const now = 1_000_000;
  markMissingFromSpotify("gone", now);
  assert.equal(negativeCacheSize(), 1);
  clearNegativeCache();
  assert.equal(negativeCacheSize(), 0);
});

test("the negative cache can be cleared between imports", () => {
  clearNegativeCache();
  markMissingFromSpotify("a");
  markMissingFromSpotify("b");
  assert.equal(negativeCacheSize(), 2);
  clearNegativeCache();
  assert.equal(negativeCacheSize(), 0);
});
