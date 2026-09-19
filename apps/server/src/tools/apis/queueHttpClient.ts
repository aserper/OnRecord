import { logger } from "../logger";
import { RateLimitState, SpotifyRateLimitError } from "./rateLimitState";
import { trafficStats } from "./trafficStats";

export type RequestPriority = "normal" | "high";

interface HttpClientRequestConfig {
  method: string;
  url: string;
  data?: any;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  priority?: RequestPriority;
  retry429MaxAttempts?: number;
  /** Reject immediately on a recorded or new 429 cooldown; retry limits do not apply. */
  failFastOnRateLimit?: boolean;
  /** Attempt despite a recorded cooldown; an actual 429 still fails fast. */
  probeDuringRateLimit?: boolean;
}

interface HttpClientResponse<T> {
  status: number;
  statusText: string;
  data: T;
}

interface QueueItem<T = any> {
  config: HttpClientRequestConfig;
  resolve: (value: HttpClientResponse<T>) => void;
  reject: (reason?: unknown) => void;
  retry429AttemptCount: number;
}

interface QueueState {
  highPriorityQueue: QueueItem<any>[];
  normalPriorityQueue: QueueItem<any>[];
  isProcessingQueue: boolean;
  lastRequestAt: number;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: string;

  constructor(options: { status: number; statusText: string; body: string }) {
    super(
      `HTTP error! status: ${options.status}, statusText: ${options.statusText}, body: ${options.body}`,
    );
    this.status = options.status;
    this.statusText = options.statusText;
    this.body = options.body;
  }
}

const DEFAULT_RETRY_429_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const MAX_COOLDOWN_WAIT_CHUNK_MS = 60_000;

function createQueueState(): QueueState {
  return {
    highPriorityQueue: [],
    normalPriorityQueue: [],
    isProcessingQueue: false,
    lastRequestAt: 0,
  };
}

export class QueuedHttpClientFactory {
  private readonly queueState: QueueState = createQueueState();

  constructor(
    private readonly options: {
      baseURL: string;
      headers: Record<string, string>;
      rateLimitState?: RateLimitState;
      minimumIntervalMs?: number;
      name?: string;
    },
  ) {}

  createClient(headers: Record<string, string>) {
    const mergedHeaders = { ...this.options.headers, ...headers };
    return new QueuedHttpClient(
      this.options.baseURL,
      mergedHeaders,
      this.queueState,
      this.options.rateLimitState,
      this.options.minimumIntervalMs,
      this.options.name,
    );
  }
}

export class QueuedHttpClient {
  constructor(
    private readonly baseURL: string,
    private readonly headers: Record<string, string>,
    private readonly queueState: QueueState = createQueueState(),
    private readonly rateLimitState?: RateLimitState,
    private readonly minimumIntervalMs = 0,
    private readonly name = "HTTP client",
  ) {}

  request<T = any>(
    config: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return new Promise<HttpClientResponse<T>>((resolve, reject) => {
      const queueItem: QueueItem<T> = {
        config: {
          ...config,
          headers: { ...this.headers, ...config.headers },
          url: config.url.startsWith("http")
            ? config.url
            : this.baseURL + config.url,
        },
        resolve,
        reject,
        retry429AttemptCount: 0,
      };

      this.enqueue(queueItem);

      this.processQueue();
    });
  }

  get<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "get", url });
  }

  delete<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "delete", url });
  }

  head<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "head", url });
  }

  options<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "options", url });
  }

  post<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "post", url });
  }

  put<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "put", url });
  }

  patch<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "patch", url });
  }

  private processQueue() {
    if (this.queueState.isProcessingQueue) {
      return;
    }

    const next = this.dequeueNext();
    if (!next) {
      return;
    }

    this.queueState.isProcessingQueue = true;

    this.execute(next)
      .catch((error) => {
        next.reject(error);
      })
      .finally(() => {
        this.queueState.isProcessingQueue = false;
        this.processQueue();
      });
  }

  private async execute<T = any>(queueItem: QueueItem<T>) {
    await this.waitForRateLimit(queueItem.config);
    await this.waitForRequestInterval();

    const url = new URL(queueItem.config.url);

    if (queueItem.config.params) {
      Object.entries(queueItem.config.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const payload: RequestInit = {
      method: queueItem.config.method,
      headers: queueItem.config.headers,
      body: queueItem.config.data
        ? JSON.stringify(queueItem.config.data)
        : undefined,
      credentials: "include",
    };

    const response = await fetch(url, payload);
    const responseBytes = this.measureResponseBytes(response);

    if (!response.ok) {
      const text = await response.text();
      trafficStats.recordRequest(this.name, responseBytes);

      if (response.status !== 429) {
        throw new HttpError({
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
      }

      const retryAfterMs = this.parseRetryAfterHeader(response);
      const retryAt = this.rateLimitState?.registerDelay(retryAfterMs);
      if (retryAt) {
        logger.warn(
          `${this.name} rate limited until ${new Date(retryAt).toISOString()}`,
        );
      }

      if (queueItem.config.failFastOnRateLimit && retryAt) {
        throw new SpotifyRateLimitError(retryAt);
      }
      const maxAttempts =
        queueItem.config.retry429MaxAttempts ?? DEFAULT_RETRY_429_MAX_ATTEMPTS;
      if (queueItem.retry429AttemptCount >= maxAttempts) {
        throw new HttpError({
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
      }

      queueItem.retry429AttemptCount += 1;
      this.requeue(queueItem);
      if (this.rateLimitState) {
        await this.waitForRateLimit(queueItem.config);
      } else {
        await this.sleep(retryAfterMs);
      }
      return;
    }

    const data = await response.json();
    trafficStats.recordRequest(this.name, responseBytes);
    queueItem.resolve({
      data,
      status: response.status,
      statusText: response.statusText,
    });
  }

  private async waitForRateLimit(config: HttpClientRequestConfig) {
    if (!this.rateLimitState) {
      return;
    }

    while (true) {
      const remaining = this.rateLimitState.getRemainingMs();
      if (remaining <= 0) {
        return;
      }
      if (config.probeDuringRateLimit) {
        return;
      }
      if (config.failFastOnRateLimit) {
        throw new SpotifyRateLimitError(this.rateLimitState.getDeadline());
      }
      await this.sleep(Math.min(remaining, MAX_COOLDOWN_WAIT_CHUNK_MS));
    }
  }

  private requeue(queueItem: QueueItem<any>) {
    if (queueItem.config.priority === "high") {
      this.queueState.highPriorityQueue.unshift(queueItem);
      return;
    }
    this.queueState.normalPriorityQueue.unshift(queueItem);
  }

  private enqueue(queueItem: QueueItem<any>) {
    if (queueItem.config.priority === "high") {
      this.queueState.highPriorityQueue.push(queueItem);
      return;
    }

    this.queueState.normalPriorityQueue.push(queueItem);
  }

  private dequeueNext() {
    return (
      this.queueState.highPriorityQueue.shift() ??
      this.queueState.normalPriorityQueue.shift()
    );
  }

  /**
   * Real payload size for accounting. `content-length` is used when present
   * and the compressed body length is the fallback, so the number reflects
   * bytes actually transferred rather than a guess.
   */
  private measureResponseBytes(response: Response): number {
    const header = response.headers.get("content-length");
    if (header) {
      const parsed = Number.parseInt(header, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 0;
  }

  private parseRetryAfterHeader(response: Response) {
    const retryAfter = response.headers.get("retry-after");
    if (!retryAfter) {
      return DEFAULT_RETRY_AFTER_MS;
    }

    const retryAfterAsNumber = Number(retryAfter);
    if (!Number.isNaN(retryAfterAsNumber)) {
      return Math.max(0, retryAfterAsNumber * 1000);
    }

    const retryAtTimestamp = Date.parse(retryAfter);
    if (Number.isNaN(retryAtTimestamp)) {
      return DEFAULT_RETRY_AFTER_MS;
    }

    return Math.max(0, retryAtTimestamp - Date.now());
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async waitForRequestInterval() {
    const remaining =
      this.queueState.lastRequestAt + this.minimumIntervalMs - Date.now();
    if (remaining > 0) {
      await this.sleep(remaining);
    }
    this.queueState.lastRequestAt = Date.now();
  }
}
