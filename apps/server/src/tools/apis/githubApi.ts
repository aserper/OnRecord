import semver from "semver";

const releasesUrl = "https://api.github.com/repos/aserper/OnRecord/releases?per_page=100";
const cacheMs = 15 * 60 * 1000;
const timeoutMs = 3000;

export class GithubAPI {
  static createVersionLookup(fetcher: typeof fetch = fetch, now = Date.now) {
    let expires = 0;
    let cached: string | null = null;
    let pending: Promise<string | null> | null = null;
    return async (): Promise<string | null> => {
      if (now() < expires) return cached;
      if (pending) return pending;
      pending = (async () => {
        try {
          const response = await fetcher(releasesUrl, {
            headers: { Accept: "application/vnd.github+json" },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
          const releases: unknown = await response.json();
          if (!Array.isArray(releases)) throw new Error("Invalid release list");
          const versions: string[] = [];
          for (const release of releases) {
            if (!release || release.draft !== false || release.prerelease !== false || typeof release.tag_name !== "string") continue;
            if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.tag_name)) continue;
            const version = semver.valid(release.tag_name);
            if (version && !semver.prerelease(version)) versions.push(version);
          }
          cached = versions.sort(semver.rcompare)[0] ?? null;
        } catch { cached = null; }
        expires = now() + cacheMs;
        return cached;
      })();
      try { return await pending; } finally { pending = null; }
    };
  }

  static lastVersion = GithubAPI.createVersionLookup();
}
