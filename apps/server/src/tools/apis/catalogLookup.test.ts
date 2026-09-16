import assert from "node:assert/strict";
import test from "node:test";

import { fetchCatalogPage } from "./catalogLookup";
import { HttpError } from "./queueHttpClient";

const httpError = (status: number) =>
  new HttpError({ status, statusText: String(status), body: "" });

const makeApp = () => {
  let batchSupported = true;
  return {
    label: "catalog-test",
    supportsBatchLookups: () => batchSupported,
    disableBatchLookups: () => {
      batchSupported = false;
    },
  };
};

test("uses one bulk request when the app supports it", async () => {
  const urls: string[] = [];
  const client = {
    get: async (url: string) => {
      urls.push(url);
      return { data: { tracks: [{ id: "a" }, { id: "b" }] } };
    },
  };
  const result = await fetchCatalogPage<{ id: string }>({
    app: makeApp(),
    client,
    entity: "tracks",
    ids: ["a", "b"],
  });

  assert.deepEqual(urls, ["/tracks?ids=a,b"]);
  assert.deepEqual(
    result.map(({ id }) => id),
    ["a", "b"],
  );
});

test("falls back to single lookups after a bulk endpoint 403", async () => {
  const urls: string[] = [];
  const app = makeApp();
  const client = {
    get: async (url: string) => {
      urls.push(url);
      if (url.includes("?ids=")) {
        throw httpError(403);
      }
      return { data: { id: url.split("/").at(-1) } };
    },
  };
  const result = await fetchCatalogPage<{ id: string }>({
    app,
    client,
    entity: "tracks",
    ids: ["a", "b"],
  });

  assert.deepEqual(urls, ["/tracks?ids=a,b", "/tracks/a", "/tracks/b"]);
  assert.deepEqual(
    result.map(({ id }) => id),
    ["a", "b"],
  );
  assert.equal(app.supportsBatchLookups(), false);
});

test("skips the bulk probe after an app is known to reject it", async () => {
  const urls: string[] = [];
  const app = makeApp();
  app.disableBatchLookups();
  const client = {
    get: async (url: string) => {
      urls.push(url);
      return { data: { id: url.split("/").at(-1) } };
    },
  };
  await fetchCatalogPage({ app, client, entity: "albums", ids: ["a", "b"] });
  assert.deepEqual(urls, ["/albums/a", "/albums/b"]);
});

test("ignores missing entities during the single lookup fallback", async () => {
  const app = makeApp();
  app.disableBatchLookups();
  const client = {
    get: async (url: string) => {
      if (url.endsWith("/missing")) {
        throw httpError(404);
      }
      return { data: { id: url.split("/").at(-1) } };
    },
  };
  const result = await fetchCatalogPage<{ id: string }>({
    app,
    client,
    entity: "artists",
    ids: ["present", "missing"],
  });
  assert.deepEqual(result, [{ id: "present" }]);
});
