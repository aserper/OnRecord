import assert from "node:assert/strict";
import { test } from "node:test";
import { Version } from "./version";

test("SemVer respects major precedence, zero components and prereleases", () => {
  assert.equal(Version.from("1.0.0").isNewerThan(Version.from("0.9.9")), true);
  assert.equal(Version.from("1.9.9").isNewerThan(Version.from("2.0.0")), false);
  assert.equal(Version.from("0.1.0").isNewerThan(Version.from("0.1.0-dev")), true);
  assert.equal(Version.from("v0.1.0").toString(), "0.1.0");
  assert.equal(Version.from("0.1.0+abc").isNewerThan(Version.from("0.1.0+def")), false);
  assert.throws(() => Version.from("nonsense"));
});
