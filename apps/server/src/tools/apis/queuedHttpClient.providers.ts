import { QueuedHttpClientFactory } from "./queueHttpClient";
import { spotifyRateLimitState } from "./rateLimitState";

export const spotifyHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.spotify.com/v1",
  headers: { "Content-Type": "application/json" },
  rateLimitState: spotifyRateLimitState,
});

export const githubHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.github.com",
  headers: { "Content-Type": "application/json" },
});
