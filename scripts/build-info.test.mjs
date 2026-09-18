import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const otherVersion = `${Number(base.split('.')[0]) + 1}.0.0`;
const run = (env = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'onrecord-build-'));
  const output = join(dir, 'build-info.json');
  const result = spawnSync(process.execPath, ['scripts/generate-build-info.mjs', '--output', output], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  const info = result.status === 0 ? JSON.parse(readFileSync(output, 'utf8')) : null;
  rmSync(dir, { recursive: true, force: true });
  return { ...result, info };
};
test('local generates metadata and published builds require provenance', () => {
  const local = run();
  assert.equal(local.status, 0, local.stderr);
  assert.equal(local.info.version, `${base}-dev`);
  assert.equal(local.info.channel, 'local');
  const noGit = run({ PATH: '/nonexistent' });
  assert.equal(noGit.status, 0, noGit.stderr);
  assert.equal(noGit.info.commit, null);
  assert.equal(noGit.info.dirty, false);
  assert.equal(typeof local.info.dirty, 'boolean');
  for (const channel of ['stable', 'edge']) assert.notEqual(run({ ONRECORD_CHANNEL: channel }).status, 0);
  const env = { ONRECORD_COMMIT: 'a'.repeat(40), ONRECORD_BUILT_AT: '2026-09-18T00:00:00Z' };
  const stable = run({ ...env, ONRECORD_CHANNEL: 'stable', ONRECORD_TAG: `v${base}` });
  assert.equal(stable.status, 0, stable.stderr);
  assert.equal(stable.info.version, base);
  assert.equal(stable.info.commit, env.ONRECORD_COMMIT);
  assert.equal(run({ ...env, ONRECORD_CHANNEL: 'edge' }).info.version, `${base}-dev`);
  for (const bad of [{ ONRECORD_TAG: `v${otherVersion}` }, { ONRECORD_COMMIT: 'short' }, { ONRECORD_BUILT_AT: 'yesterday' }, { ONRECORD_VERSION: otherVersion }]) {
    assert.notEqual(run({ ...env, ONRECORD_CHANNEL: 'stable', ONRECORD_TAG: `v${base}`, ...bad }).status, 0);
  }
});
