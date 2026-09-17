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

/** A single app-only client for public Spotify catalog metadata. */
export class CatalogApp {
  readonly label: string;
  readonly rateLimitState: RateLimitState;
  private readonly factory: QueuedHttpClientFactory;
  private token: CachedToken | null = null;
  private batchLookupsDisabled = false;
  private readonly fetchToken: typeof defaultFetchToken;

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
      name: this.label,
    });
    this.fetchToken = options.fetchToken ?? defaultFetchToken;
  }

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

/** Primary-app catalog access; intentionally has no credential rotation. */
export class CatalogPool {
  constructor(private readonly app: CatalogApp) {}

  get size(): number {
    return 1;
  }

  getBlockingDeadline(now = Date.now()): number {
    const deadline = this.app.availableAt();
    return deadline > now ? deadline : 0;
  }

  invalidateTokens() {
    this.app.invalidateToken();
  }

  async acquireAll(): Promise<{ app: CatalogApp; client: QueuedHttpClient }[]> {
    try {
      return [{ app: this.app, client: await this.app.createClient() }];
    } catch (error) {
      logger.warn(
        `Catalog app ${this.app.label} failed to authenticate; retrying after ten minutes`,
      );
      this.app.penalize();
      throw error;
    }
  }
}

export function createCatalogPool(): CatalogPool {
  const primary = new CatalogApp(
    { clientId: get("SPOTIFY_PUBLIC")!, clientSecret: get("SPOTIFY_SECRET")! },
    {
      rateLimitState: spotifyRateLimitState,
      minimumIntervalMs: getWithDefault("SPOTIFY_REQUEST_INTERVAL_MS", 1000),
    },
  );
  logger.info("Catalog requests use the primary Spotify app");
  return new CatalogPool(primary);
}

let pool: CatalogPool | null = null;

export function getCatalogPool(): CatalogPool {
  if (!pool) {
    pool = createCatalogPool();
  }
  return pool;
}
