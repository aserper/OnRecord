import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const generate = (output) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['scripts/generate-build-info.mjs', '--if-missing', '--output', output], { env: { PATH: process.env.PATH } });
  let stderr = '';
  child.stderr.on('data', (data) => { stderr += data; });
  child.on('close', (status) => resolve({ status, stderr }));
});

test('concurrent fresh development starts install one complete shared identity', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'onrecord-dev-'));
  try {
    const output = join(dir, 'build-info.json');
    const results = await Promise.all(Array.from({ length: 8 }, () => generate(output)));
    for (const result of results) assert.equal(result.status, 0, result.stderr);
    const first = readFileSync(output, 'utf8');
    assert.equal(JSON.parse(first).channel, 'local');
    assert.equal((await generate(output)).status, 0);
    assert.equal(readFileSync(output, 'utf8'), first, 'a second starter must not change the shared identity');
    assert.deepEqual(readdirSync(dir), ['build-info.json'], 'no temporary files remain');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('development replaces published and stale local identities', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'onrecord-dev-stale-'));
  try {
    const output = join(dir, 'build-info.json');
    assert.equal((await generate(output)).status, 0);
    const local = JSON.parse(readFileSync(output, 'utf8'));
    for (const changed of [{ channel: 'stable' }, { channel: 'edge' }, { commit: 'b'.repeat(40) }, { version: '99.0.0-dev' }, { dirty: !local.dirty }]) {
      writeFileSync(output, JSON.stringify({ ...local, ...changed, builtAt: '2000-01-01T00:00:00Z' }));
      assert.equal((await generate(output)).status, 0);
      const refreshed = JSON.parse(readFileSync(output, 'utf8'));
      for (const key of ['channel', 'commit', 'version', 'dirty']) assert.equal(refreshed[key], local[key]);
      assert.notEqual(refreshed.builtAt, '2000-01-01T00:00:00Z');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('both development entrypoints ensure metadata before starting rsbuild', () => {
  for (const [app, script] of [['client', 'start'], ['server', 'dev']]) {
    const pkg = JSON.parse(readFileSync(new URL(`../apps/${app}/package.json`, import.meta.url), 'utf8'));
    assert.ok(pkg.scripts[script].startsWith('node ../../scripts/generate-build-info.mjs --if-missing && '));
    assert.equal(pkg.scripts.build, 'rsbuild build', 'production builds consume the single root identity');
  }
});
