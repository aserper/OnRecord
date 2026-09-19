import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_DAYS = 90;
const FLUSH_INTERVAL_MS = 5_000;

interface ClientTotals {
  requests: number;
  bytes: number;
}

interface DayTotals {
  requests: number;
  bytes: number;
  cacheHits: number;
  cacheMisses: number;
}

interface PersistedTraffic {
  totalRequests: number;
  totalBytes: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  byClient: Record<string, ClientTotals>;
  byDay: Record<string, DayTotals>;
}

function emptyTotals(): PersistedTraffic {
  return {
    totalRequests: 0,
    totalBytes: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    byClient: {},
    byDay: {},
  };
}

/**
 * Counts Spotify traffic so the UI can show how much data was actually
 * downloaded and how much was avoided by the persistent catalog cache.
 *
 * Byte counts come from the response bodies at the single HTTP chokepoint, so
 * they are measured rather than estimated. Counters are persisted next to the
 * cooldown file so a restart does not reset the totals, and writes are
 * coalesced because a large import issues thousands of requests.
 */
export class TrafficStats {
  private data: PersistedTraffic = emptyTotals();
  private dirty = false;
  private flushTimer?: NodeJS.Timeout;
  private readonly file?: string;

  constructor(file?: string) {
    this.file = file;
    this.load();
  }

  recordRequest(client: string, bytes: number) {
    const size = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;
    this.data.totalRequests += 1;
    this.data.totalBytes += size;

    const clientTotals = this.data.byClient[client] ?? {
      requests: 0,
      bytes: 0,
    };
    clientTotals.requests += 1;
    clientTotals.bytes += size;
    this.data.byClient[client] = clientTotals;

    const day = this.dayTotals();
    day.requests += 1;
    day.bytes += size;

    this.markDirty();
  }

  /** Catalog entities answered from MongoDB instead of Spotify. */
  recordCacheHits(count: number) {
    if (count <= 0) {
      return;
    }
    this.data.totalCacheHits += count;
    this.dayTotals().cacheHits += count;
    this.markDirty();
  }

  /** Catalog entities that still required a Spotify request. */
  recordCacheMisses(count: number) {
    if (count <= 0) {
      return;
    }
    this.data.totalCacheMisses += count;
    this.dayTotals().cacheMisses += count;
    this.markDirty();
  }

  snapshot() {
    const cacheLookups = this.data.totalCacheHits + this.data.totalCacheMisses;
    const avgBytesPerRequest =
      this.data.totalRequests > 0
        ? this.data.totalBytes / this.data.totalRequests
        : 0;

    const days = Object.entries(this.data.byDay)
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return {
      totalRequests: this.data.totalRequests,
      totalBytes: this.data.totalBytes,
      totalCacheHits: this.data.totalCacheHits,
      totalCacheMisses: this.data.totalCacheMisses,
      /** Share of catalog lookups answered without a Spotify request. */
      cacheHitRate:
        cacheLookups > 0 ? this.data.totalCacheHits / cacheLookups : 0,
      avgBytesPerRequest,
      /**
       * Bytes the cache avoided, derived from the average response size. This
       * is an estimate: skipped responses are never measured.
       */
      estimatedBytesAvoided: Math.round(
        this.data.totalCacheHits * avgBytesPerRequest,
      ),
      byClient: Object.entries(this.data.byClient)
        .map(([client, totals]) => ({ client, ...totals }))
        .sort((a, b) => b.bytes - a.bytes),
      days: days.slice(0, 14),
    };
  }

  flush() {
    if (!this.dirty || !this.file) {
      return;
    }
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(this.data)}\n`, {
        mode: 0o600,
      });
      renameSync(temporary, this.file);
      this.dirty = false;
    } catch {
      // Traffic accounting must never break request handling.
    }
  }

  private dayTotals(): DayTotals {
    const date = new Date().toISOString().slice(0, 10);
    const existing = this.data.byDay[date];
    if (existing) {
      return existing;
    }
    const created: DayTotals = {
      requests: 0,
      bytes: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.data.byDay[date] = created;
    this.pruneDays();
    return created;
  }

  private pruneDays() {
    const dates = Object.keys(this.data.byDay).sort();
    while (dates.length > MAX_DAYS) {
      const oldest = dates.shift();
      if (oldest) {
        delete this.data.byDay[oldest];
      }
    }
  }

  private markDirty() {
    this.dirty = true;
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  private load() {
    if (!this.file) {
      return;
    }
    try {
      const parsed = JSON.parse(
        readFileSync(this.file, "utf8"),
      ) as Partial<PersistedTraffic>;
      this.data = {
        ...emptyTotals(),
        ...parsed,
        byClient: parsed.byClient ?? {},
        byDay: parsed.byDay ?? {},
      };
    } catch {
      // Missing or unreadable stats start from zero.
    }
  }
}

const cooldownFile = process.env.SPOTIFY_COOLDOWN_FILE;
export const trafficStats = new TrafficStats(
  process.env.SPOTIFY_TRAFFIC_FILE ??
    (cooldownFile ? join(dirname(cooldownFile), "traffic.json") : undefined),
);
