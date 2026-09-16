# OnRecord

![OnRecord](apps/client/public/brand/social.png)

Self-hosted Spotify listening history. OnRecord continuously records what you listen to and turns it into an archive you can actually explore: rankings, trends, sessions, and playlists, with four distinct interface themes.

OnRecord is a fork of [Yooooomi/your_spotify](https://github.com/Yooooomi/your_spotify), renamed and extended. Credit for the original application belongs to Yooooomi and the upstream contributors.

## Features

- **Four themes:** Atlas, Programme, Darkroom, and Standard, each with light and dark modes. Switch freely; your route, date range, and theme preference are preserved.
- **Deep exploration:** move from an overview statistic down to the artists, albums, tracks, and sessions behind it. Everything has a full history.
- **Scheduled history imports:** upload Spotify export files now and start the import at an off-hours time. Pending jobs survive restarts and can be cancelled.
- **Playlist tracking:** paste a playlist link and OnRecord records every track that is added to or removed from it, with a full change history.
- **Gentle on Spotify's API:** configurable request pacing, an isolated login queue, and cooldown persistence. Scheduling and pacing respect Spotify's limits; they do not increase your quota.
 - **Gentle on Spotify's API:** metadata lookups are batched (up to 50 tracks, 20 albums, or 50 artists per request), with configurable request pacing, an isolated login queue, and cooldown persistence. This respects Spotify's limits; it does not increase your quota.
- **ARM64 and AMD64:** images are published for both architectures.

[Installation](#installation) · [Configuration](#configuration) · [History imports](#history-imports) · [Playlist tracking](#playlist-tracking) · [Troubleshooting](#troubleshooting) · [Development](#development) · [Credits](#support-and-credits)

## Installation

### 1. Create a Spotify application

Create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard), enable **Web API**, and copy the client ID and client secret. Add the users who should have access through the app's user management settings.

Register this redirect URI on the app, replacing the domain with yours:

```
https://music.example.com/api/oauth/spotify/callback
```

The scheme, hostname, port, and path must match your deployment exactly. Use HTTPS for anything reachable over the internet.

### 2. Run the containers

OnRecord ships as a single container that serves the web app and the API; MongoDB runs separately.

Create a `.env` file next to your `compose.yaml` and keep it out of version control:

```
SPOTIFY_PUBLIC=your_spotify_client_id
SPOTIFY_SECRET=your_spotify_client_secret
```

Create writable storage directories for the user the container runs as:

```
mkdir -p data/config data/imports
sudo chown -R 1000:1000 data/config data/imports
```

Save this as `compose.yaml`:

```
services:
  onrecord:
    image: ghcr.io/aserper/onrecord:latest
    restart: unless-stopped
    depends_on:
      - mongo
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: Etc/UTC
      APP_URL: https://music.example.com
      SPOTIFY_PUBLIC: ${SPOTIFY_PUBLIC:?Set SPOTIFY_PUBLIC in .env}
      SPOTIFY_SECRET: ${SPOTIFY_SECRET:?Set SPOTIFY_SECRET in .env}
      MONGO_ENDPOINT: mongodb://mongo:27017/onrecord
      TIMEZONE: Etc/UTC
      SPOTIFY_REQUEST_INTERVAL_MS: "200"
      COOKIE_VALIDITY_MS: "2592000000"
      SPOTIFY_COOLDOWN_FILE: /config/spotify-cooldown.json
    ports:
      - "127.0.0.1:8080:80"
    volumes:
      - ./data/config:/config
      - ./data/imports:/tmp/imports

  mongo:
    image: mongo:8
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

Start it:

```
docker compose up -d
docker compose logs -f onrecord
```

Put a TLS-terminating reverse proxy in front of `http://127.0.0.1:8080` and serve `https://music.example.com` through it. If your proxy is itself a container, attach it to the same Docker network and point it at `onrecord:80` instead. Keep MongoDB off the public internet, and raise your proxy's upload size and timeout limits so large history exports go through.

The first account to register becomes an administrator. Once your users have joined, you can disable new registrations in **Settings**.

### Storage

| Path | What it holds |
| :--- | :--- |
| `/config` | Container configuration and, in this example, the Spotify cooldown file |
| `/tmp/imports` | Uploaded import files needed by pending and retryable jobs |
| MongoDB volume | Users, listening history, preferences, and import job records |

All three are required for scheduled imports to survive a restart. If you move `SPOTIFY_COOLDOWN_FILE` elsewhere, persist its parent directory, not a single-file mount: the server writes a temporary file and renames it.

Before updating, back up MongoDB and the storage directories, and avoid updating while an import is running:

```
docker compose pull onrecord
docker compose up -d onrecord
```

For reproducible deployments, pin the image by digest instead of `latest`, and do not change MongoDB major versions without following MongoDB's upgrade procedure.

## Configuration

The combined image derives `CLIENT_ENDPOINT` from `APP_URL` and serves the API under `${APP_URL}/api`. Set `APP_URL` to the address your browser uses, without a trailing slash. Do not override the internal server port.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `APP_URL` | Set explicitly | Public URL of the deployment |
| `SPOTIFY_PUBLIC`, `SPOTIFY_SECRET` | Required | Spotify app client ID and secret |
| `PUID`, `PGID`, `TZ` | Set explicitly | Container file ownership and timezone |
| `MONGO_ENDPOINT` | `mongodb://mongo:27017/your_spotify` | MongoDB connection string |
| `TIMEZONE` | `Europe/Paris` | Default statistics timezone; each user can override it in Settings |
| `SPOTIFY_REQUEST_INTERVAL_MS` | `200` | Minimum interval in milliseconds between Spotify API requests; use it instead of the delay variables other forks document |
| `SPOTIFY_COOLDOWN_FILE` | Unset | File used to persist the Spotify rate-limit deadline across restarts |
| `SPOTIFY_EXTRA_APPS` | Unset | Additional Spotify app credentials (`clientId:clientSecret` pairs, comma-separated). Catalog lookups during imports round-robin across these apps, each with its own rate budget, so one app's cooldown cannot stall an import. Create the extra apps in the Spotify dashboard; each app must comply with Spotify's developer terms. |
| `COOKIE_VALIDITY_MS` | `1h` | Sign-in token lifetime; a numeric millisecond value also makes the browser cookie persistent |
| `MAX_IMPORT_CACHE_SIZE` | `100000` | Import cache entries; a larger cache uses more memory and sends fewer requests to Spotify |
| `CORS` | Origin of `CLIENT_ENDPOINT` | Comma-separated additional browser origins |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `MONGO_NO_ADMIN_RIGHTS` | `false` | Set `true` when your MongoDB credentials cannot run admin commands |
| `PROMETHEUS_USERNAME`, `PROMETHEUS_PASSWORD` | Unset | Basic-auth credentials for [metrics](apps/server/README.md#prometheus) |
| `CLIENT_ENDPOINT`, `API_ENDPOINT`, `PORT` | Required for source installs | Only needed when you run the client and server separately |

Notes:

- `COOKIE_VALIDITY_MS=2592000000` (30 days) keeps you signed in and reduces how often Spotify re-authentication is needed.
- `CORS` rarely needs an override. If you set it, list exact origins such as `https://music.example.com` without paths, trailing slashes, or default ports.

## History imports

After registration, OnRecord polls Spotify for new listening as it happens. Your past history is not included: request an export from [Spotify account privacy](https://www.spotify.com/account/privacy/), then open **Settings → Account → Import data**.

- **Account data:** `StreamingHistory*.json` files, generally covering the past year.
- **Extended streaming history (recommended):** `Streaming_History_Audio_*.json` files, covering your account's full history.

Upload the extracted JSON files, not the ZIP. Spotify controls how long exports take to arrive.

Choose **Start now** or **Schedule for later**. Scheduling uses your browser's local time and suggests the next 02:00 by default. Files are uploaded immediately and stored; a scheduler checks for due jobs at startup and every 30 seconds.

Restart behavior:

- A **pending scheduled job** survives a restart if MongoDB and `/tmp/imports` are preserved.
- A job that was **running or starting** when the server stopped is marked failed and does not resume automatically. Use **Retry** in the import history; its files must still exist.
- **Cancel scheduled import** removes a pending job and its uploaded files. Cleaning up a failed import also removes its files, so retry before cleaning up if you still want the import.

Imports can also fail on API errors or exhausted retries. Duplicate detection limits overlap with existing history, but a small number of duplicates can still occur.

## Playlist tracking

Open **Playlists**, paste a Spotify playlist link (an `open.spotify.com` URL, a `spotify:playlist:` URI, or a bare playlist id), and confirm. OnRecord snapshots the playlist, then re-checks it about every ten minutes and records every track that is **added** or **removed**, with names and artists.

- Reorders and duplicate copies of a track already present are not reported as changes.
- The history keeps the last 50 changes per playlist, and **Check now** forces an immediate check.
- Public playlists work for every signed-in user. Tracking private or collaborative playlists requires extra scopes: use **Reconnect** under **Spotify connection** in Settings once.
- Checks respect the same rate limits as everything else; if Spotify asks the app to pause, tracking pauses with it.

## Troubleshooting

**Spotify asks the app to pause.** Requests wait out the recorded cooldown, then continue automatically. Restarting the container or deleting the cooldown file does not reset Spotify's quota; only waiting does.

**Login fails.** Check the registered redirect URI, `APP_URL`, and your proxy's routing to `/api`. If Spotify itself returned a rate limit during sign-in, wait for the reported time and start a fresh sign-in.

**Listening history stops updating.** If you revoked Spotify access, use **Reconnect** under **Spotify connection** in Settings. Server logs show API errors and cooldowns.

**An import cannot start or files are missing.** Verify `/tmp/imports` is mounted persistently and writable by the container's user, and check disk space and proxy upload limits.

**Statistics use the wrong timezone.** Set your timezone in Settings. `TIMEZONE` is only the server-side default; history timestamps use your device's timezone and are stored in UTC.

## Development

Use Node.js 24 and pnpm 10.17.1, matching the [Dockerfile](Dockerfile) and CI:

```
git clone https://github.com/aserper/OnRecord.git
cd OnRecord
npm install --global pnpm@10.17.1
pnpm install --frozen-lockfile
pnpm --filter @onrecord/server test
pnpm --filter @onrecord/server typecheck
pnpm --filter @onrecord/client typecheck
pnpm --filter @onrecord/server build
pnpm --filter @onrecord/client build
```

To run from source, point `CLIENT_ENDPOINT` and `API_ENDPOINT` at your local setup, provide the Spotify credentials, run `pnpm --filter @onrecord/server migrate`, then `pnpm --filter @onrecord/server start`. Serve `apps/client/build` as a static site with unknown routes falling back to `index.html`, copying `variables-template.js` to `variables.js` and replacing `__API_ENDPOINT__` with the backend URL. A directly exposed backend uses `/oauth/spotify/callback`; `/api/oauth/spotify/callback` applies when a proxy mounts the backend under `/api`.

## Support and credits

Found a bug or want a feature? [Open an issue](https://github.com/aserper/OnRecord/issues) with the image digest or commit, your configuration with secrets removed, and redacted logs.

- **Upstream project:** [Yooooomi/your_spotify](https://github.com/Yooooomi/your_spotify) and its [issues](https://github.com/Yooooomi/your_spotify/issues) for upstream-specific questions.
- **Container base:** [LinuxServer Your Spotify](https://github.com/linuxserver/docker-your_spotify).
- **License:** [GNU GPL v3](LICENSE), retained from upstream.
