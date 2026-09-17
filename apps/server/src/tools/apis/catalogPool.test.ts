import assert from "node:assert/strict";
import test from "node:test";

import { CatalogApp, CatalogPool } from "./catalogPool";
import { RateLimitState } from "./rateLimitState";

const makeApp = (options?: {
  rateLimitState?: RateLimitState;
  fetchToken?: () => Promise<{ accessToken: string; expiresInMs: number }>;
}) =>
  new CatalogApp(
    { clientId: "primaryaaaaaaaaaaaaaaaaaaaaaaaaa", clientSecret: "secret" },
    {
      rateLimitState: options?.rateLimitState ?? new RateLimitState(),
      minimumIntervalMs: 0,
      fetchToken:
        options?.fetchToken ??
        (async () => ({ accessToken: "token", expiresInMs: 3_600_000 })),
    },
  );

test("catalog pool exposes exactly one primary app", async () => {
  const app = makeApp();
  const pool = new CatalogPool(app);
  const acquired = await pool.acquireAll();
  assert.equal(pool.size, 1);
  assert.equal(acquired.length, 1);
  assert.equal(acquired[0]!.app, app);
});

test("catalog pool reports the primary cooldown deadline", () => {
  const state = new RateLimitState();
  const app = makeApp({ rateLimitState: state });
  const pool = new CatalogPool(app);
  assert.equal(pool.getBlockingDeadline(), 0);

  const deadline = state.registerDelay(60_000);
  assert.equal(pool.getBlockingDeadline(), deadline);
});

test("client-credentials tokens are cached until near expiry", async () => {
  let tokenFetches = 0;
  const pool = new CatalogPool(
    makeApp({
      fetchToken: async () => {
        tokenFetches += 1;
        return { accessToken: "token", expiresInMs: 3_600_000 };
      },
    }),
  );
  await pool.acquireAll();
  await pool.acquireAll();
  await pool.acquireAll();
  assert.equal(tokenFetches, 1);
});

test("authentication failure applies a temporary cooldown", async () => {
  const state = new RateLimitState();
  const pool = new CatalogPool(
    makeApp({
      rateLimitState: state,
      fetchToken: async () => {
        throw new Error("bad credentials");
      },
    }),
  );
  await assert.rejects(() => pool.acquireAll(), /bad credentials/);
  assert.ok(state.getRemainingMs() > 0);
});
