import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { TrafficStats } from "./trafficStats";

const withStats = (run: (stats: TrafficStats, file: string) => void) => {
  const directory = mkdtempSync(join(tmpdir(), "onrecord-traffic-"));
  const file = join(directory, "traffic.json");
  try {
    run(new TrafficStats(file), file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("counts requests and measured bytes per client", () => {
  withStats((stats) => {
    stats.recordRequest("Spotify primary API", 1200);
    stats.recordRequest("Spotify primary API", 800);
    stats.recordRequest("Spotify login API", 300);

    const snapshot = stats.snapshot();
    assert.equal(snapshot.totalRequests, 3);
    assert.equal(snapshot.totalBytes, 2300);
    assert.equal(snapshot.byClient.length, 2);
    assert.deepEqual(snapshot.byClient[0], {
      client: "Spotify primary API",
      requests: 2,
      bytes: 2000,
    });
    assert.equal(snapshot.avgBytesPerRequest, 2300 / 3);
  });
});

test("ignores non-positive byte counts rather than corrupting totals", () => {
  withStats((stats) => {
    stats.recordRequest("client", -5);
    stats.recordRequest("client", Number.NaN);
    const snapshot = stats.snapshot();
    assert.equal(snapshot.totalRequests, 2);
    assert.equal(snapshot.totalBytes, 0);
  });
});

test("computes the cache hit rate and estimated avoided bytes", () => {
  withStats((stats) => {
    // Three cached answers and one Spotify fetch of 400 bytes.
    stats.recordRequest("client", 400);
    stats.recordCacheHits(3);
    stats.recordCacheMisses(1);

    const snapshot = stats.snapshot();
    assert.equal(snapshot.totalCacheHits, 3);
    assert.equal(snapshot.totalCacheMisses, 1);
    assert.equal(snapshot.cacheHitRate, 0.75);
    assert.equal(snapshot.avgBytesPerRequest, 400);
    assert.equal(snapshot.estimatedBytesAvoided, 1200);
  });
});

test("hit rate is zero when nothing has been looked up", () => {
  withStats((stats) => {
    assert.equal(stats.snapshot().cacheHitRate, 0);
    assert.equal(stats.snapshot().estimatedBytesAvoided, 0);
  });
});

test("persists totals across restarts", () => {
  const directory = mkdtempSync(join(tmpdir(), "onrecord-traffic-"));
  const file = join(directory, "traffic.json");
  try {
    const first = new TrafficStats(file);
    first.recordRequest("client", 1000);
    first.recordCacheHits(2);
    first.flush();

    const second = new TrafficStats(file);
    const snapshot = second.snapshot();
    assert.equal(snapshot.totalRequests, 1);
    assert.equal(snapshot.totalBytes, 1000);
    assert.equal(snapshot.totalCacheHits, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("writes a readable payload and never throws on flush", () => {
  withStats((stats, file) => {
    stats.recordRequest("client", 42);
    stats.flush();
    const persisted = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(persisted.totalRequests, 1);
    assert.equal(persisted.totalBytes, 42);
    // Flushing again with no changes is a no-op, not an error.
    stats.flush();
  });
});

test("reports a per-day breakdown, newest first", () => {
  withStats((stats) => {
    stats.recordRequest("client", 500);
    stats.recordCacheHits(1);
    const [day] = stats.snapshot().days;
    assert.ok(day);
    assert.equal(day.requests, 1);
    assert.equal(day.bytes, 500);
    assert.equal(day.cacheHits, 1);
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
  });
});
