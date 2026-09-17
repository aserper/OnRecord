import { getWithDefault } from "../env";
import { QueuedHttpClientFactory } from "./queueHttpClient";
import { spotifyRateLimitState } from "./rateLimitState";

export const spotifyHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.spotify.com/v1",
  headers: { "Content-Type": "application/json" },
  rateLimitState: spotifyRateLimitState,
  minimumIntervalMs: getWithDefault("SPOTIFY_REQUEST_INTERVAL_MS", 1000),
  name: "Spotify primary API",
});

export const spotifyLoginHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.spotify.com/v1",
  headers: { "Content-Type": "application/json" },
  rateLimitState: spotifyRateLimitState,
  name: "Spotify login API",
});

export const githubHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.github.com",
  headers: { "Content-Type": "application/json" },
  name: "GitHub API",
});
