import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogApp,
  CatalogPool,
  catalogCooldownFilePath,
  parseExtraApps,
} from "./catalogPool";
import { RateLimitState } from "./rateLimitState";

const fakeTokenFetcher = () => async () => ({
  accessToken: `token-${Math.random()}`,
  expiresInMs: 3_600_000,
});

const makeApp = (
  index: number,
  options?: {
    fetchToken?: () => Promise<{ accessToken: string; expiresInMs: number }>;
  },
) =>
  new CatalogApp(
    {
      clientId: `id${index}aaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
      clientSecret: `secret${index}`,
    },
    {
      rateLimitState: new RateLimitState(),
      minimumIntervalMs: 0,
      fetchToken: options?.fetchToken ?? fakeTokenFetcher(),
    },
  );

test("parseExtraApps splits id:secret pairs", () => {
  const apps = parseExtraApps("idA:secretA, idB:secretB");
  assert.deepEqual(apps, [
    { clientId: "idA", clientSecret: "secretA" },
    { clientId: "idB", clientSecret: "secretB" },
  ]);
});

test("parseExtraApps skips invalid entries", () => {
  const apps = parseExtraApps("nocolon,:nosecret,good:ok,");
  assert.deepEqual(apps, [{ clientId: "good", clientSecret: "ok" }]);
});

test("parseExtraApps handles unset input", () => {
  assert.deepEqual(parseExtraApps(undefined), []);
  assert.deepEqual(parseExtraApps(""), []);
});

test("catalogCooldownFilePath sits beside the base file", () => {
  assert.equal(
    catalogCooldownFilePath("/config/spotify-cooldown.json", 2),
    "/config/catalog-cooldown-2.json",
  );
  assert.equal(catalogCooldownFilePath(undefined, 1), undefined);
});

test("acquire returns null when no apps are configured", async () => {
  const pool = new CatalogPool([]);
  assert.equal(await pool.acquire(), null);
});

test("acquire round-robins across healthy apps", async () => {
  const pool = new CatalogPool([makeApp(1), makeApp(2), makeApp(3)]);
  const chosen = [];
  for (let i = 0; i < 6; i += 1) {
    const { app } = (await pool.acquire())!;
    chosen.push(app.label);
  }
  const unique = new Set(chosen);
  assert.equal(unique.size, 3);
});

test("acquire skips apps in cooldown", async () => {
  const cooling = makeApp(1);
  cooling.rateLimitState.registerDelay(3_600_000);
  const pool = new CatalogPool([cooling, makeApp(2), makeApp(3)]);
  for (let i = 0; i < 4; i += 1) {
    const { app } = (await pool.acquire())!;
    assert.notEqual(app, cooling);
  }
});

test("acquire waits on the earliest deadline when all apps cool", async () => {
  const soon = makeApp(1);
  const later = makeApp(2);
  soon.rateLimitState.registerDelay(60_000);
  later.rateLimitState.registerDelay(600_000);
  const pool = new CatalogPool([later, soon]);
  const { app } = (await pool.acquire())!;
  assert.equal(app, soon);
});

test("acquire penalizes an app whose token fetch fails", async () => {
  const broken = makeApp(1, {
    fetchToken: async () => {
      throw new Error("bad credentials");
    },
  });
  const healthy = makeApp(2);
  const pool = new CatalogPool([broken, healthy]);
  const { app } = (await pool.acquire())!;
  assert.equal(app, healthy);
  // The broken app is now cooling down; healthy keeps serving.
  for (let i = 0; i < 3; i += 1) {
    const next = (await pool.acquire())!;
    assert.notEqual(next.app, broken);
  }
});

test("tokens are cached until near expiry", async () => {
  let tokenFetches = 0;
  const app = makeApp(1, {
    fetchToken: async () => {
      tokenFetches += 1;
      return { accessToken: "t", expiresInMs: 3_600_000 };
    },
  });
  const pool = new CatalogPool([app]);
  await pool.acquire();
  await pool.acquire();
  await pool.acquire();
  assert.equal(tokenFetches, 1);
});
