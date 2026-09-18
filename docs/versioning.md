# Versioning and publishing OnRecord

OnRecord starts its own release line at **0.1.0**. Root `package.json` is the version source; client, server, and dev package versions must agree. Inherited upstream bare tags such as `1.20` remain historical references: do not delete, move, or publish them as OnRecord releases. Only exact `vMAJOR.MINOR.PATCH` tags can publish stable images.

## Channels and identity

All images are `ghcr.io/aserper/onrecord`, built for `linux/amd64` and `linux/arm64`.

| Source | Tags | Embedded / OCI version |
| --- | --- | --- |
| `master` commit | `edge`, `sha-<full 40-character SHA>` | `0.1.0-dev` |
| `v0.1.0` tag | `0.1.0`, `latest`, `sha-<full SHA>-stable` | `0.1.0` |
| Local build | no automatic publication | `0.1.0-dev`, channel `local` |

`latest` means stable, never the latest master build. Edge and stable builds of the same commit have different channel metadata and therefore deliberately different immutable tags/digests. Deployments should pin the selected channel by digest, for example `edge@sha256:...` to retain master cadence, or `0.1.0@sha256:...` for a stable rollout. Publishing does not modify deployments or Argo configuration.

The publisher determines the checked-out full commit and generates one UTC ISO build timestamp with `new Date().toISOString()`. It exports `ONRECORD_VERSION` (root version), `ONRECORD_COMMIT`, `ONRECORD_BUILT_AT`, `ONRECORD_CHANNEL`, and `ONRECORD_TAG` (stable `v0.1.0`, otherwise empty). `scripts/generate-build-info.mjs` creates shared metadata before either application build. Identical inputs are passed as Docker build arguments for both architectures. OCI version is the display version (`-dev` for edge), revision is the full commit, created is the same build timestamp, and `io.onrecord.channel` identifies the channel. Runtime configuration must not claim a different build identity.

## Initial release

1. Merge the versioning implementation to `master` with a releasable conventional commit, e.g. `feat: establish OnRecord versioning`. Verify Container CI and edge is green.
2. Release Please opens the initial **0.1.0** release PR. Review the package changes, manifest, and generated changelog; do not auto-merge. If necessary run the **Release Please** workflow on `master` to retry.
3. Merge that reviewed PR. Release Please creates the exact `v0.1.0` tag and GitHub Release, then directly calls the reusable publisher with that tag. The publisher checks that the tag matches package versions and points to a commit on `master`.
4. Verify the publish job, both architectures, registry digest, and embedded version before separately approving any deployment change.

Bootstrap uses an empty `.release-please-manifest.json`, `initial-version: 0.1.0`, and a `bootstrap-sha` at the last pre-versioning OnRecord commit. There are no inherited GitHub releases to seed this line; bare upstream tags are neither new release triggers nor renamed. After the first release, Release Please records the version in its manifest and uses its release history. `initial-version` only applies before a first release; there is deliberately **no persistent `release-as` pin**. The bootstrap SHA can be removed after the first successful release.

### Explicit-tag bootstrap/recovery alternative

If an operator creates the first release manually, first merge and verify the complete versioning implementation. Create `v0.1.0` on that exact reviewed `master` SHA, not on whichever commit happens to be current later. Create a published, non-prerelease GitHub Release for that existing tag. Preserve the tag forever. Record `{".": "0.1.0"}` in `.release-please-manifest.json` through a reviewed PR when bootstrapping outside Release Please.

A human tag push triggers **Publish stable tag**. If an event was suppressed or publication failed, explicitly dispatch the publisher without creating or moving a tag:

```sh
gh workflow run stable.yml --repo aserper/OnRecord --ref master -f tag=v0.1.0
```

The input must identify an existing exact stable tag. Dispatch does **not** create a release or tag. Never dispatch a branch/SHA as a stable version or recreate a failed release tag on a newer commit.

## Future releases

Use conventional commits: `fix:` increments patch, `feat:` increments minor, and breaking changes increment minor before 1.0 (major afterwards). Release Please maintains a reviewable PR containing changelog, root version, all three application package versions, and its manifest. Review and merge normally. No workflow auto-merges PRs. The Node strategy updates supported Node lockfiles; this repository's pnpm workspace lock does not encode package root versions. Frozen installation remains a required check.

The `GITHUB_TOKEN` cannot normally trigger downstream push/release workflows. Consequently `release.yml` calls `publish.yml` directly when `release_created` is true, using the returned exact `tag_name`; it does not depend on a second tag event. The separate tag/dispatch entry point covers human-created tags and recovery.

## Checks, retries, and permissions

Publication runs targeted lint on the versioning implementation, offline publishing-policy regression tests, metadata/version tests, client build-info tests, server tests, both application typechecks/builds, and a multiarchitecture Docker build. Pull requests perform the same build validation without registry login or push. After pushing, every requested tag must resolve to the returned digest, and the registry index must contain both target architectures.

Publishers are serialized and never cancel an in-progress publication. Before a write the registry guard examines every required architecture. Existing immutable identities must match source, version, and channel. A matching release is a no-op, preserving its original build timestamp/digest and leaving moving channel tags untouched. A different source, conflicting digest, or partial publication fails closed. Authentication, rate-limit, and server errors are not interpreted as missing images. New stable releases cannot move `latest` backwards relative to its currently labeled stable version. Only the legacy edge/unlabeled `latest` migration is exempt from stable ordering.

Edge builds push only their immutable SHA tag first. After index verification, a live GitHub master lookup must match the built commit immediately before promoting `edge` by digest. A stale retry without an immutable image may finish its immutable build but cannot move `edge`. A second lookup detects a master push during promotion and fails the run; GitHub refs and GHCR cannot be updated atomically, so the alias may briefly lag master, but serialized publishers cannot roll back a newer publisher. Lookup failures fail closed. If an immutable build succeeded but promotion failed, retries intentionally leave the alias alone: allow a newer master run to publish, or review the immutable digest and current master before an operator restores the alias. Never repair by rebuilding the immutable tag.

If publication partially succeeds, stop and inspect digests. Restore missing aliases to the already-built digest only after review; never rebuild/overwrite an existing stable version. Protect `v*` tags from update/deletion and restrict GHCR writes: workflow safeguards cannot prevent an administrator or unrelated publisher from overwriting registry tags. GitHub concurrency has one pending slot, so rapid pushes may supersede a pending run; explicitly dispatch a missing stable tag if necessary.

Required repository settings:

- Actions enabled and permitted to use the referenced actions.
- `GITHUB_TOKEN` allowed to create pull requests (Settings → Actions → General → Allow GitHub Actions to create and approve pull requests). This setting does not make the workflow approve or merge them.
- Release Please explicitly requests `contents: write` and `pull-requests: write`; publishers request `contents: read` and `packages: write`.
- The GHCR package must grant this repository write access. No Docker Hub credentials, PAT, or new secret is assumed.
- Branch/tag protection and organizational policy must permit release PR creation and approved release tagging.

Release PRs created using `GITHUB_TOKEN` may not trigger normal pull-request CI. Before merging, a maintainer must cause a human-authenticated PR update (for example close/reopen) or otherwise run the required checks under the repository's policy. Do not bypass required checks. Stable publication always reruns its own validation on the tagged source.

Local publishing-policy checks (no credentials/network needed once dependencies exist):

```sh
python -m pip install PyYAML==6.0.2
python .github/workflows/test_release_contract.py
actionlint
pnpm check:versions
pnpm lint:versioning
pnpm test:versioning
pnpm --filter @onrecord/client test
```
