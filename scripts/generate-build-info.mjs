import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, linkSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const env = process.env;
const channel = env.ONRECORD_CHANNEL || 'local';
const fail = (message) => { throw new Error(message); };
if (!['local', 'edge', 'stable'].includes(channel)) fail('Invalid ONRECORD_CHANNEL');
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(base)) fail('Root version must be stable SemVer');
if (env.ONRECORD_VERSION && env.ONRECORD_VERSION !== base) fail('ONRECORD_VERSION must match root package.json');
if (channel === 'stable' && env.ONRECORD_TAG !== `v${base}`) fail('Stable ONRECORD_TAG must match root version');
const git = (...args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const commit = env.ONRECORD_COMMIT || (channel === 'local' ? git('rev-parse', 'HEAD') : null);
const builtAt = env.ONRECORD_BUILT_AT || (channel === 'local' ? new Date().toISOString() : null);
if (commit !== null && !/^[a-f0-9]{40}$/.test(commit)) fail('ONRECORD_COMMIT must be a full lowercase SHA');
if (builtAt !== null && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(builtAt) || !Number.isFinite(Date.parse(builtAt)))) fail('ONRECORD_BUILT_AT must be an ISO UTC date');
if (channel !== 'local' && (!commit || !builtAt)) fail('Published builds require commit and builtAt');
const info = { version: channel === 'stable' ? base : `${base}-dev`, commit, builtAt, channel, dirty: channel === 'local' && Boolean(git('status', '--porcelain')) };
const args = process.argv.slice(2);
const ifMissing = args[0] === '--if-missing';
if (ifMissing) args.shift();
if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1])) fail('Usage: generate-build-info.mjs [--if-missing] [--output path]');
if (ifMissing && channel !== 'local') fail('--if-missing is only for local development');
const output = args[1] || fileURLToPath(new URL('../build-info.json', import.meta.url));
const temporary = `${output}.${randomUUID()}.tmp`;
// Publish only complete JSON. link is create-if-absent: concurrent dev starters
// adopt the same winner rather than truncating or replacing each other's file.
writeFileSync(temporary, JSON.stringify(info, null, 2) + '\n', { flag: 'wx' });
try {
  if (ifMissing) {
    try {
      linkSync(temporary, output);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = JSON.parse(readFileSync(output, 'utf8'));
      // Reuse a matching local identity, but never label dev as an old release.
      if (['version', 'commit', 'channel', 'dirty'].some((key) => existing[key] !== info[key])) {
        renameSync(temporary, output);
      }
    }
  } else {
    renameSync(temporary, output);
  }
} finally {
  rmSync(temporary, { force: true });
}
console.log(JSON.stringify(JSON.parse(readFileSync(output, 'utf8'))));
