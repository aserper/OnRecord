import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RateLimitState, SpotifyRateLimitError } from "./rateLimitState";

test("a missing cooldown file starts at zero", () => {
  const directory = mkdtempSync(join(tmpdir(), "onrecord-rate-limit-"));
  try {
    const state = new RateLimitState(join(directory, "cooldown.json"));
    assert.equal(state.getDeadline(), 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cooldown writes are persisted and monotonic", () => {
  const directory = mkdtempSync(join(tmpdir(), "onrecord-rate-limit-"));
  const file = join(directory, "cooldown.json");
  try {
    const state = new RateLimitState(file);
    const first = state.registerDelay(60_000);
    const second = state.registerDelay(1);
    const persisted = JSON.parse(readFileSync(file, "utf8"));

    assert.equal(second, first);
    assert.equal(persisted.deadline, first);
    assert.equal(new RateLimitState(file).getDeadline(), first);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("absolute deadlines preserve their exact timestamp", () => {
  const directory = mkdtempSync(join(tmpdir(), "onrecord-rate-limit-"));
  const file = join(directory, "cooldown.json");
  try {
    const state = new RateLimitState(file);
    const deadline = Date.now() + 123_456;
    assert.equal(state.registerDeadline(deadline), deadline);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).deadline, deadline);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a later persisted deadline extends a running process", () => {
  const directory = mkdtempSync(join(tmpdir(), "onrecord-rate-limit-"));
  const file = join(directory, "cooldown.json");
  try {
    const state = new RateLimitState(file);
    const deadline = Date.now() + 120_000;
    writeFileSync(file, JSON.stringify({ deadline }));
    assert.equal(state.getDeadline(), deadline);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("typed errors expose a safe retry deadline", () => {
  const retryAt = Date.now() + 60_000;
  const error = new SpotifyRateLimitError(retryAt);
  assert.equal(error.code, "SPOTIFY_RATE_LIMITED");
  assert.equal(error.retryAt, retryAt);
  assert.match(error.message, /Spotify is rate limited until/);
});
