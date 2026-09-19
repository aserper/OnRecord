import assert from "node:assert/strict";
import test from "node:test";

import { formatBytes, formatCount, formatPercent } from "./format.ts";

test("formats measured byte totals", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-10), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KiB");
  assert.equal(formatBytes(1024 * 1024 * 3.5), "3.5 MiB");
});

test("formats counts with separators", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(1234567), (1234567).toLocaleString());
});

test("never rounds a non-perfect hit rate up to 100%", () => {
  assert.equal(formatPercent(0), "0%");
  assert.equal(formatPercent(0.5), "50%");
  assert.equal(formatPercent(0.999), ">99%");
  assert.equal(formatPercent(1), "100%");
});
