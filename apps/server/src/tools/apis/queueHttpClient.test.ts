import assert from "node:assert/strict";
import { createServer, RequestListener } from "node:http";
import test from "node:test";

import { QueuedHttpClient } from "./queueHttpClient";
import { RateLimitState, SpotifyRateLimitError } from "./rateLimitState";

async function withServer(
  handler: RequestListener,
  run: (url: string) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("a 429 is requeued and resolves only after a successful response", async () => {
  let requests = 0;
  await withServer(
    (_, response) => {
      requests += 1;
      response.setHeader("content-type", "application/json");
      if (requests === 1) {
        response.statusCode = 429;
        response.setHeader("retry-after", "0");
        response.end('{"error":"slow down"}');
        return;
      }
      response.end('{"ok":true}');
    },
    async (url) => {
      const client = new QueuedHttpClient(
        url,
        {},
        undefined,
        new RateLimitState(),
      );
      const response = await client.get<{ ok: boolean }>("/");
      assert.equal(response.data.ok, true);
      assert.equal(requests, 2);
    },
  );
});

test("successful responses never register Retry-After", async () => {
  const state = new RateLimitState();
  await withServer(
    (_, response) => {
      response.setHeader("content-type", "application/json");
      response.setHeader("retry-after", "600");
      response.end('{"ok":true}');
    },
    async (url) => {
      const client = new QueuedHttpClient(url, {}, undefined, state);
      await client.get("/");
      assert.equal(state.getDeadline(), 0);
    },
  );
});

test("fail-fast requests expose a typed cooldown error", async () => {
  const state = new RateLimitState();
  await withServer(
    (_, response) => {
      response.statusCode = 429;
      response.setHeader("content-type", "application/json");
      response.setHeader("retry-after", "60");
      response.end('{"error":"slow down"}');
    },
    async (url) => {
      const client = new QueuedHttpClient(url, {}, undefined, state);
      await assert.rejects(
        client.get("/me", { failFastOnRateLimit: true }),
        (error: unknown) =>
          error instanceof SpotifyRateLimitError &&
          error.code === "SPOTIFY_RATE_LIMITED" &&
          error.retryAt > Date.now(),
      );
    },
  );
});
