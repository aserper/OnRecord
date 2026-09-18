import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const version = JSON.parse(readFileSync(new URL('package.json', root))).version;
for (const app of readdirSync(new URL('apps/', root))) {
  const pkg = JSON.parse(readFileSync(new URL(`apps/${app}/package.json`, root)));
  if (pkg.version !== version) throw new Error(`${pkg.name}: ${pkg.version} != ${version}`);
}
console.log(`All package versions match ${version}`);
