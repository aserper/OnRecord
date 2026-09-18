import assert from "node:assert/strict";
import { test } from "node:test";
import { getVersionResponse, type BuildInfo } from "./buildInfo";
import { GithubAPI } from "./apis/githubApi";

const info: BuildInfo = { version: "0.1.0", commit: "a".repeat(40), builtAt: "2026-09-18T00:00:00Z", channel: "stable", dirty: false };
test("metadata survives lookup failures and updates are stable-only", async () => {
  const failed = await getVersionResponse(info, async () => { throw new Error("offline"); });
  assert.equal(failed.update, false);
  assert.equal(failed.commit, info.commit);
  assert.equal(failed.releaseUrl, "https://github.com/aserper/OnRecord/releases/tag/v0.1.0");
  const latest = async () => "0.2.0";
  assert.equal((await getVersionResponse(info, latest)).updateUrl, "https://github.com/aserper/OnRecord/releases/tag/v0.2.0");
  for (const channel of ["edge", "local"] as const) {
    let called = false;
    const result = await getVersionResponse({ ...info, version: "0.1.0-dev", channel }, async () => { called = true; return "0.2.0"; });
    assert.equal(result.update, false);
    assert.equal(result.releaseUrl, null);
    assert.equal(called, false);
  }
  assert.equal((await getVersionResponse(info, async () => "0.2.0-rc.1")).update, false);
});

test("GitHub lookup filters drafts/prereleases, sorts SemVer, caches errors and successes", async () => {
  let calls = 0;
  const fetcher = async (url: string | URL | Request) => {
    calls++;
    assert.equal(url, "https://api.github.com/repos/aserper/OnRecord/releases?per_page=100");
    return new Response(JSON.stringify([
      { tag_name: "v0.2.0", draft: false, prerelease: false },
      { tag_name: "v0.10.0", draft: false, prerelease: false },
      { tag_name: "v9.0.0", draft: true, prerelease: false },
      { tag_name: "v8.0.0", draft: false, prerelease: true },
      { tag_name: "v7.0.0-rc.1", draft: false, prerelease: false },
      { tag_name: "not-semver", draft: false, prerelease: false },
      { tag_name: "99.0.0", draft: false, prerelease: false },
    ]));
  };
  const lookup = GithubAPI.createVersionLookup(fetcher);
  assert.equal(await lookup(), "0.10.0");
  assert.equal(await lookup(), "0.10.0");
  assert.equal(calls, 1);
  let failures = 0;
  const offline = GithubAPI.createVersionLookup(async () => { failures++; throw new Error("offline"); });
  assert.equal(await offline(), null);
  assert.equal(await offline(), null);
  assert.equal(failures, 1);
});
