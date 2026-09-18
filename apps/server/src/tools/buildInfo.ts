import semver from "semver";
import { GithubAPI } from "./apis/githubApi";

export interface BuildInfo {
  version: string;
  commit: string | null;
  builtAt: string | null;
  channel: "stable" | "edge" | "local";
  dirty: boolean;
}
const repository = "https://github.com/aserper/OnRecord";
export async function getVersionResponse(
  info: BuildInfo = __BUILD_INFO__,
  latest: () => Promise<string | null> = GithubAPI.lastVersion,
) {
  let updateVersion: string | null = null;
  if (info.channel === "stable") {
    try {
      const candidate = await latest();
      if (candidate && semver.valid(candidate) && !semver.prerelease(candidate) && semver.gt(candidate, info.version)) updateVersion = candidate;
    } catch { /* Offline release lookup must not hide installed identity. */ }
  }
  return {
    ...info,
    update: updateVersion !== null,
    commitUrl: info.commit && /^[a-f0-9]{40}$/.test(info.commit) ? `${repository}/commit/${info.commit}` : null,
    releaseUrl: info.channel === "stable" && semver.valid(info.version) ? `${repository}/releases/tag/v${info.version}` : null,
    updateUrl: updateVersion ? `${repository}/releases/tag/v${updateVersion}` : null,
  };
}
