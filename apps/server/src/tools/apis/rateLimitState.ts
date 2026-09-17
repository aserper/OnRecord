import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface PersistedCooldown {
  deadline: number;
}

export class SpotifyRateLimitError extends Error {
  readonly code = "SPOTIFY_RATE_LIMITED";
  readonly retryAt: number;

  constructor(retryAt: number) {
    super(`Spotify is rate limited until ${new Date(retryAt).toISOString()}`);
    this.name = "SpotifyRateLimitError";
    this.retryAt = retryAt;
  }
}

export class RateLimitState {
  private deadline: number;
  private readonly file?: string;

  constructor(file?: string) {
    this.file = file;
    this.deadline = this.readPersistedDeadline();
  }

  getDeadline() {
    this.deadline = Math.max(this.deadline, this.readPersistedDeadline());
    return this.deadline;
  }

  getRemainingMs() {
    return Math.max(0, this.getDeadline() - Date.now());
  }

  registerDelay(delayMs: number) {
    const deadline = Date.now() + Math.max(0, delayMs);
    return this.registerDeadline(deadline);
  }

  /** Registers an absolute deadline without losing precision during migration. */
  registerDeadline(deadline: number) {
    if (!Number.isFinite(deadline) || deadline < 0) {
      return this.getDeadline();
    }
    if (deadline <= this.getDeadline()) {
      return this.deadline;
    }
    this.deadline = deadline;
    this.persist();
    return this.deadline;
  }

  private readPersistedDeadline() {
    if (!this.file) {
      return 0;
    }
    try {
      const parsed = JSON.parse(
        readFileSync(this.file, "utf8"),
      ) as PersistedCooldown;
      return Number.isFinite(parsed.deadline) && parsed.deadline >= 0
        ? parsed.deadline
        : 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return 0;
      }
      return 0;
    }
  }

  private persist() {
    if (!this.file) {
      return;
    }
    mkdirSync(dirname(this.file), { recursive: true });
    const temporaryFile = `${this.file}.${process.pid}.tmp`;
    writeFileSync(
      temporaryFile,
      `${JSON.stringify({ deadline: this.deadline })}\n`,
      { mode: 0o600 },
    );
    renameSync(temporaryFile, this.file);
  }
}

export const spotifyRateLimitState = new RateLimitState(
  process.env.SPOTIFY_COOLDOWN_FILE,
);
