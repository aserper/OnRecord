import { dirname, join } from "node:path";

import { get, getWithDefault } from "../env";
import { logger } from "../logger";
import { QueuedHttpClient, QueuedHttpClientFactory } from "./queueHttpClient";
import { RateLimitState, spotifyRateLimitState } from "./rateLimitState";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const APP_FAILURE_COOLDOWN_MS = 600_000;

export interface SpotifyAppCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Parses SPOTIFY_EXTRA_APPS: comma-separated `clientId:clientSecret` pairs.
 * Invalid entries are skipped so one bad value cannot disable the others.
 */
export function parseExtraApps(
  raw: string | undefined,
): SpotifyAppCredentials[] {
  if (!raw) {
    return [];
  }
  const apps: SpotifyAppCredentials[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf(":");
    if (separator <= 0 || separator === trimmed.length - 1) {
      logger.warn(
        "Ignoring an invalid SPOTIFY_EXTRA_APPS entry (expected clientId:clientSecret)",
      );
      continue;
    }
    apps.push({
      clientId: trimmed.slice(0, separator),
      clientSecret: trimmed.slice(separator + 1),
    });
  }
  return apps;
}

export function catalogCooldownFilePath(
  base: string | undefined,
  index: number,
): string | undefined {
  if (!base) {
    return undefined;
  }
  return join(dirname(base), `catalog-cooldown-${index}.json`);
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

async function defaultFetchToken(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresInMs: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(
      `Spotify client-credentials token request failed with ${response.status}`,
    );
  }
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("Spotify client-credentials response had no token");
  }
  return {
    accessToken: data.access_token,
    expiresInMs: (data.expires_in ?? 3600) * 1000,
  };
}

export class CatalogApp {
  readonly label: string;
  readonly rateLimitState: RateLimitState;
  private readonly factory: QueuedHttpClientFactory;
  private token: CachedToken | null = null;
  private batchLookupsDisabled = false;

  constructor(
    private readonly credentials: SpotifyAppCredentials,
    options: {
      rateLimitState: RateLimitState;
      minimumIntervalMs?: number;
      fetchToken?: typeof defaultFetchToken;
    },
  ) {
    this.label = `catalog-${credentials.clientId.slice(0, 6)}…`;
    this.rateLimitState = options.rateLimitState;
    this.factory = new QueuedHttpClientFactory({
      baseURL: "https://api.spotify.com/v1",
      headers: { "Content-Type": "application/json" },
      rateLimitState: options.rateLimitState,
      minimumIntervalMs: options.minimumIntervalMs,
    });
    this.fetchToken = options.fetchToken ?? defaultFetchToken;
  }

  private fetchToken: typeof defaultFetchToken;

  availableAt(): number {
    return this.rateLimitState.getDeadline();
  }

  invalidateToken() {
    this.token = null;
  }

  supportsBatchLookups(): boolean {
    return !this.batchLookupsDisabled;
  }

  disableBatchLookups() {
    this.batchLookupsDisabled = true;
  }

  async createClient(): Promise<QueuedHttpClient> {
    const token = await this.getToken();
    return this.factory.createClient({ Authorization: `Bearer ${token}` });
  }

  /** Cooldowns this app after a failure so the pool tries others first. */
  penalize() {
    this.rateLimitState.registerDelay(APP_FAILURE_COOLDOWN_MS);
    this.invalidateToken();
  }

  private async getToken(): Promise<string> {
    if (
      this.token &&
      this.token.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS
    ) {
      return this.token.value;
    }
    const { accessToken, expiresInMs } = await this.fetchToken(
      this.credentials.clientId,
      this.credentials.clientSecret,
    );
    this.token = { value: accessToken, expiresAt: Date.now() + expiresInMs };
    logger.info(`Refreshed client-credentials token for ${this.label}`);
    return accessToken;
  }
}

export class CatalogPool {
  private cursor = 0;

  constructor(private readonly apps: CatalogApp[]) {}

  get size(): number {
    return this.apps.length;
  }

  /** Returns zero when at least one app can run now, otherwise the first deadline. */
  getBlockingDeadline(now = Date.now()): number {
    if (this.apps.length === 0) {
      return 0;
    }
    const deadlines = this.apps.map((app) => app.availableAt());
    return deadlines.some((deadline) => deadline <= now)
      ? 0
      : Math.min(...deadlines);
  }

  invalidateTokens() {
    for (const app of this.apps) {
      app.invalidateToken();
    }
  }

  /**
   * Round-robins over apps that are not in a Spotify cooldown. When every
   * app is cooling down, waits on the one with the earliest deadline rather
   * than failing. Returns null when no extra apps are configured, so callers
   * can fall back to the primary user-token client.
   */
  async acquire(): Promise<{
    app: CatalogApp;
    client: QueuedHttpClient;
  } | null> {
    if (this.apps.length === 0) {
      return null;
    }
    const preferred = this.rotate(this.availableApps());

    let lastError: unknown;
    for (const app of preferred) {
      try {
        const client = await app.createClient();
        return { app, client };
      } catch (error) {
        lastError = error;
        logger.warn(
          `Catalog app ${app.label} failed to authenticate; skipping it for ten minutes`,
        );
        app.penalize();
      }
    }
    throw lastError ?? new Error("No catalog app could be used");
  }

  /** Acquires one independently queued client for every healthy Spotify app. */
  async acquireAll(): Promise<{ app: CatalogApp; client: QueuedHttpClient }[]> {
    if (this.apps.length === 0) {
      return [];
    }
    const outcomes = await Promise.all(
      this.availableApps().map(async (app) => {
        try {
          return { result: { app, client: await app.createClient() } };
        } catch (error) {
          logger.warn(
            `Catalog app ${app.label} failed to authenticate; skipping it for ten minutes`,
          );
          app.penalize();
          return { error };
        }
      }),
    );
    const acquired = outcomes.flatMap((outcome) =>
      outcome.result ? [outcome.result] : [],
    );
    if (acquired.length > 0) {
      return acquired;
    }
    const failed = outcomes.find((outcome) => outcome.error);
    throw failed?.error ?? new Error("No catalog app could be used");
  }

  private availableApps(): CatalogApp[] {
    const now = Date.now();
    const ordered = [...this.apps].sort(
      (a, b) => a.availableAt() - b.availableAt(),
    );
    const healthy = ordered.filter((app) => app.availableAt() <= now);
    return healthy.length > 0 ? healthy : [ordered[0]!];
  }

  private rotate(candidates: CatalogApp[]): CatalogApp[] {
    if (candidates.length <= 1) {
      return candidates;
    }
    const start = this.cursor % candidates.length;
    this.cursor = (this.cursor + 1) % candidates.length;
    return [...candidates.slice(start), ...candidates.slice(0, start)];
  }
}

export function createCatalogPool(): CatalogPool {
  const primary = new CatalogApp(
    { clientId: get("SPOTIFY_PUBLIC")!, clientSecret: get("SPOTIFY_SECRET")! },
    {
      rateLimitState: spotifyRateLimitState,
      minimumIntervalMs: get("SPOTIFY_REQUEST_INTERVAL_MS"),
    },
  );
  const extras = parseExtraApps(get("SPOTIFY_EXTRA_APPS")).map(
    (credentials, index) =>
      new CatalogApp(credentials, {
        rateLimitState: new RateLimitState(
          catalogCooldownFilePath(get("SPOTIFY_COOLDOWN_FILE"), index + 1),
        ),
        minimumIntervalMs: getWithDefault(
          "SPOTIFY_EXTRA_APP_INTERVAL_MS",
          1000,
        ),
      }),
  );
  if (extras.length > 0) {
    logger.info(
      `Catalog request pool initialized with ${extras.length} extra Spotify app(s); primary app reserved for user data`,
    );
    return new CatalogPool(extras);
  }
  logger.info("Catalog request pool initialized with the primary Spotify app");
  return new CatalogPool([primary]);
}

let pool: CatalogPool | null = null;

/** Shared catalog pool; extra apps take over completely when configured. */
export function getCatalogPool(): CatalogPool {
  if (!pool) {
    pool = createCatalogPool();
  }
  return pool;
}
