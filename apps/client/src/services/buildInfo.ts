export interface BuildInfo {
  version: string;
  commit: string | null;
  builtAt: string | null;
  channel: "stable" | "edge" | "local";
  dirty: boolean;
}

// Optional metadata keeps older servers usable during rolling upgrades.
export interface VersionResponse extends Partial<BuildInfo> {
  version: string;
  update: boolean;
  commitUrl?: string | null;
  releaseUrl?: string | null;
  updateUrl?: string | null;
}

const repository = "https://github.com/aserper/OnRecord";

function normalizeBuild(value: unknown): BuildInfo {
  const input =
    value && typeof value === "object" ? (value as Partial<BuildInfo>) : {};
  return {
    version:
      typeof input.version === "string" && input.version
        ? input.version
        : "dev",
    commit:
      typeof input.commit === "string" &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.commit)
        ? input.commit
        : null,
    builtAt:
      typeof input.builtAt === "string" &&
      Number.isFinite(Date.parse(input.builtAt))
        ? input.builtAt
        : null,
    channel:
      input.channel === "stable" || input.channel === "edge"
        ? input.channel
        : "local",
    dirty: input.dirty === true,
  };
}

function releaseLink(value: unknown): string | null {
  return typeof value === "string" &&
    /^https:\/\/github\.com\/aserper\/OnRecord\/releases\/tag\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(
      value,
    )
    ? value
    : null;
}

export function buildDisplay(
  frontendValue: unknown,
  backendValue?: VersionResponse | null,
) {
  const frontend = normalizeBuild(frontendValue);
  const backend = normalizeBuild(backendValue);
  // Build timestamps can differ between rebuilds of the same source identity.
  // Unknown/local metadata is not evidence of a stale browser bundle.
  const mismatch = Boolean(
    frontend.commit &&
    backend.commit &&
    (frontend.commit !== backend.commit ||
      frontend.version !== backend.version ||
      frontend.channel !== backend.channel ||
      frontend.dirty !== backend.dirty),
  );
  const versionLabel =
    frontend.channel === "local" ? "dev" : `v${frontend.version}`;
  const commitLabel = frontend.commit?.slice(0, 7) ?? "unknown";
  return {
    versionLabel,
    commitLabel,
    dirty: frontend.dirty,
    label: `${versionLabel} · ${commitLabel}${frontend.dirty ? " · dirty" : ""}`,
    details: `Frontend: ${frontend.version}. Commit: ${frontend.commit ?? "unknown"}. Channel: ${frontend.channel}. Built: ${frontend.builtAt ?? "unknown"}.${frontend.dirty ? " Uncommitted changes." : ""}`,
    commitUrl: frontend.commit
      ? `${repository}/commit/${frontend.commit}`
      : null,
    releaseUrl:
      frontend.channel === "stable" &&
      !frontend.dirty &&
      !mismatch &&
      backendValue?.releaseUrl ===
        `${repository}/releases/tag/v${frontend.version}`
        ? releaseLink(backendValue.releaseUrl)
        : null,
    updateUrl:
      backendValue?.update === true
        ? releaseLink(backendValue.updateUrl)
        : null,
    mismatch,
  };
}
