import { logger } from "../logger";
import { CatalogApp } from "./catalogPool";
import { HttpError } from "./queueHttpClient";

export type CatalogEntity = "tracks" | "albums" | "artists";

interface CatalogClient {
  get(url: string): Promise<{ data: any }>;
}
type BatchCapability = Pick<
  CatalogApp,
  "label" | "supportsBatchLookups" | "disableBatchLookups"
>;

/**
 * Uses Spotify's efficient bulk endpoint when an app supports it. New
 * Development Mode apps return 403 for those endpoints as of February 2026;
 * detect that once and transparently fall back to supported single-item calls.
 */
export async function fetchCatalogPage<T>(options: {
  app?: BatchCapability;
  client: CatalogClient;
  entity: CatalogEntity;
  ids: string[];
}): Promise<T[]> {
  const { app, client, entity, ids } = options;
  if (app?.supportsBatchLookups() !== false) {
    try {
      const { data } = await client.get(`/${entity}?ids=${ids.join(",")}`);
      return (data[entity] ?? []) as T[];
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 403) {
        throw error;
      }
      app?.disableBatchLookups();
      logger.warn(
        `${app?.label ?? "Spotify app"} does not support bulk catalog endpoints; using individual ${entity} lookups`,
      );
    }
  }

  const results: T[] = [];
  for (const id of ids) {
    try {
      const { data } = await client.get(`/${entity}/${id}`);
      results.push(data as T);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }
  return results;
}
