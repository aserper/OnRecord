// Run: node --experimental-strip-types --test apps/client/src/services/buildInfo.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { buildDisplay } from "./buildInfo.ts";

const commit = "abc1234" + "0".repeat(33);
const build = {
  version: "0.1.0",
  commit,
  builtAt: "2026-09-18T12:00:00.000Z",
  channel: "stable",
  dirty: false,
};

test("shows the compiled stable identity with full accessible detail", () => {
  const display = buildDisplay(build, { ...build, update: false });
  assert.equal(display.label, "v0.1.0 · abc1234");
  assert.equal(
    display.commitUrl,
    `https://github.com/aserper/OnRecord/commit/${commit}`,
  );
  assert.match(display.details, new RegExp(commit));
  assert.match(display.details, /stable/);
  assert.match(display.details, /2026-09-18T12:00:00.000Z/);
  assert.equal(display.mismatch, false);
  assert.equal(display.releaseUrl, null);
});

test("compares known frontend/backend identities without local or legacy false positives", () => {
  const changed = { ...build, commit: "d".repeat(40) };
  assert.equal(buildDisplay(build, changed).mismatch, true);
  assert.equal(buildDisplay(build, changed).label, "v0.1.0 · abc1234");
  assert.equal(
    buildDisplay(build, { ...build, version: "0.2.0" }).mismatch,
    true,
  );
  assert.equal(
    buildDisplay(build, { ...build, channel: "edge" }).mismatch,
    true,
  );
  assert.equal(buildDisplay(build, { ...build, dirty: true }).mismatch, true);
  assert.equal(
    buildDisplay(build, { ...build, builtAt: "2026-09-19T12:00:00Z" }).mismatch,
    false,
  );
  assert.equal(
    buildDisplay(build, { version: "1.20.1", update: true }).mismatch,
    false,
  );
  assert.equal(buildDisplay(undefined, changed).mismatch, false);
  assert.equal(
    buildDisplay({ ...build, channel: "local", commit: null }, changed)
      .mismatch,
    false,
  );
  assert.equal(buildDisplay(build, null).mismatch, false);
});

test("only exposes exact fork release links confirmed by runtime metadata", () => {
  const releaseUrl = "https://github.com/aserper/OnRecord/releases/tag/v0.1.0";
  const updateUrl = "https://github.com/aserper/OnRecord/releases/tag/v0.2.0";
  assert.equal(
    buildDisplay(build, { ...build, releaseUrl }).releaseUrl,
    releaseUrl,
  );
  assert.equal(
    buildDisplay(build, { ...build, update: true, updateUrl }).updateUrl,
    updateUrl,
  );
  assert.equal(
    buildDisplay(build, { ...build, update: false, updateUrl }).updateUrl,
    null,
  );
  assert.equal(
    buildDisplay(build, { ...build, version: "0.2.0", releaseUrl: updateUrl })
      .releaseUrl,
    null,
  );
  for (const url of [
    "https://github.com/Yooooomi/your_spotify/releases/tag/v0.1.0",
    "https://github.com/aserper/OnRecord/releases",
    "javascript:alert(1)",
    releaseUrl + "?next=evil",
    "https://github.com/aserper/OnRecord/releases/tag/../../issues",
    "https://github.com/aserper/OnRecord.evil/releases/tag/v0.1.0",
  ]) {
    assert.equal(
      buildDisplay(build, {
        ...build,
        releaseUrl: url,
        updateUrl: url,
        update: true,
      }).releaseUrl,
      null,
    );
    assert.equal(
      buildDisplay(build, { ...build, updateUrl: url, update: true }).updateUrl,
      null,
    );
  }
  assert.equal(
    buildDisplay({ ...build, channel: "edge" }, { ...build, releaseUrl })
      .releaseUrl,
    null,
  );
});

test("distinguishes edge, local, dirty and unavailable frontend builds", () => {
  assert.equal(
    buildDisplay({ ...build, version: "0.1.0-dev", channel: "edge" }).label,
    "v0.1.0-dev · abc1234",
  );
  assert.equal(
    buildDisplay({ ...build, channel: "local", dirty: true }).label,
    "dev · abc1234 · dirty",
  );
  assert.equal(buildDisplay(undefined, build).label, "dev · unknown");
  assert.equal(buildDisplay({ version: "0.1.0" }).label, "dev · unknown");
  assert.equal(
    buildDisplay({ ...build, commit: "not-a-sha", builtAt: "invalid" })
      .commitUrl,
    null,
  );
  assert.match(buildDisplay(null).details, /unknown/);
});
