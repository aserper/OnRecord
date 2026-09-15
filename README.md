# OnRecord

![OnRecord](apps/client/public/brand/social.png)

Self-hosted Spotify listening history, with four interface themes, detailed listening statistics, and scheduled history imports.

OnRecord is [aserper/OnRecord](https://github.com/aserper/OnRecord), a fork of **[Yooooomi/your_spotify](https://github.com/Yooooomi/your_spotify)** renamed and extended. Credit for the original application and its statistics platform belongs to Yooooomi and the upstream contributors. This fork builds on that work with a redesigned interface and changes to import scheduling, login handling, and deployment.

## What this fork includes

- **Four themes:** Atlas, Programme, Darkroom, and Standard, with light and dark appearance settings.
- **Deep listening exploration:** track, album, and artist histories; listening sessions; rankings over time; and comparisons between users.
- **Scheduled imports:** upload Spotify export files now and choose an off-hours start time. Pending jobs survive restarts when MongoDB and the upload directory are persistent. Cancel a pending schedule from import history.
- **An isolated login queue:** login and profile requests do not wait behind bulk import requests. They can try during a recorded bulk cooldown, but an actual Spotify `429` response still produces a retry-later response.
- **Configurable request pacing and sessions:** set the interval between bulk Spotify requests and the authentication cookie lifetime. Optionally persist Spotify's cooldown deadline across restarts.

Spotify's API limits still apply. Scheduling and pacing do not increase your quota or guarantee an uninterrupted import.

[Installation](#installation) · [Configuration](#configuration) · [History imports](#history-imports) · [Troubleshooting](#troubleshooting) · [Development](#development) · [Support](#support-and-credits)

## Installation

### 1. Create a Spotify application

Create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard), select **Web API**, and copy its client ID and client secret. Follow Spotify's current account and development-mode requirements; add other permitted users through the app's user management settings.

For the combined container documented here, register this exact redirect URI, replacing the example domain with yours:

```text
https://music.example.com/api/oauth/spotify/callback
```

The scheme, hostname, port, and path must match your deployment. Use HTTPS for a remote deployment. For local testing, follow Spotify's current loopback redirect rules rather than assuming `localhost` is accepted.

### 2. Run the combined image and MongoDB

The fork publishes **`ghcr.io/aserper/onrecord:latest`**. If the pull fails with `denied`, the package is still private: flip it to public once under the package's Package settings. Its [Dockerfile](Dockerfile) builds this repository's client and server, then installs them into a pinned [LinuxServer Your Spotify image](https://github.com/linuxserver/docker-your_spotify). The container serves the frontend at `/` and the API at `/api`; MongoDB runs separately.

The upstream `yooooomi/your_spotify_server` and `yooooomi/your_spotify_client` images do **not** contain this fork's changes. The existing split-container Compose files in this repository are legacy examples, not the installation below.

Create a private `.env` file beside your `compose.yaml`:

```dotenv
SPOTIFY_PUBLIC=replace_with_spotify_client_id
SPOTIFY_SECRET=replace_with_spotify_client_secret
```

Keep this file out of version control and restrict its permissions (`chmod 600 .env`). Create writable storage directories, using the UID and GID you will set as `PUID` and `PGID`:

```sh
mkdir -p data/config data/imports
sudo chown -R 1000:1000 data/config data/imports
```

Save this as `compose.yaml`:

```yaml
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

```sh
docker compose up -d
docker compose logs -f onrecord
```

Point a TLS-terminating reverse proxy on the Docker host at `http://127.0.0.1:8080`, serving `https://music.example.com`. Forward the original host and scheme. If your proxy is another container, connect it to the same Docker network and use `onrecord:80` instead. Do not expose MongoDB publicly. Adjust proxy upload-size and timeout limits for large history exports.

The first registered account becomes an administrator. Once your users have joined, you can disable new registrations in **Settings**.

### Storage and updates

Keep all three storage locations:

| Container path | What it preserves |
| :--- | :--- |
| `/config` | LinuxServer runtime configuration and, in this example, the cooldown file |
| `/tmp/imports` | Uploaded files needed by pending jobs and failed-import retries |
| `/data/db` in MongoDB | Users, listening history, preferences, and import job records |

If you set `SPOTIFY_COOLDOWN_FILE` elsewhere, persist its **parent directory** and make it writable by `PUID`/`PGID`. The server writes a temporary file and renames it, so use a directory mount rather than a single-file mount. A `/config` volume alone does not preserve `/tmp/imports`.

Back up MongoDB and the app storage before updating. Avoid updates during a running import. To update only the app image:

```sh
docker compose pull onrecord
docker compose up -d onrecord
```

For reproducible deployments, pin a published image digest instead of `latest`. Do not change MongoDB major versions without following MongoDB's upgrade procedure.

The [Kubernetes manifest](deploy/onrecord.yaml) shows the combined image, persistent uploads, cooldown storage, and MongoDB in use. It is deployment-specific: replace its storage, ingress, certificate, and secret references before using it. The [container workflow](.github/workflows/container.yml) verifies the code, publishes GHCR images, and records the image digest in that manifest.

## Configuration

The combined image derives `CLIENT_ENDPOINT` from `APP_URL` and `API_ENDPOINT` from `${APP_URL}/api`. Set `APP_URL` to the URL your browser uses, without a trailing slash. Do not override the internal server port in this image.

Server settings are defined in [env.ts](apps/server/src/tools/env.ts); defaults below refer to this fork's server, not every LinuxServer image version.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `APP_URL` | Set explicitly | Public URL for the combined image |
| `SPOTIFY_PUBLIC`, `SPOTIFY_SECRET` | Required | Spotify app client ID and secret |
| `PUID`, `PGID`, `TZ` | Set explicitly | Container file ownership and operating-system timezone |
| `MONGO_ENDPOINT` | `mongodb://mongo:27017/your_spotify` | MongoDB connection string |
| `TIMEZONE` | `Europe/Paris` | Default statistics timezone; each user can override it in Settings |
| `SPOTIFY_REQUEST_INTERVAL_MS` | `200` | Minimum interval in milliseconds between bulk-queue request starts; nonnegative |
| `SPOTIFY_COOLDOWN_FILE` | Unset | File for persisting the rate-limit deadline; otherwise held in memory |
| `COOKIE_VALIDITY_MS` | `1h` | Authentication token lifetime; use a positive integer in milliseconds for a persistent browser cookie too |
| `MAX_IMPORT_CACHE_SIZE` | `100000` | Import cache entry limit; a larger cache uses more memory to reduce API lookups |
| `CORS` | Origin of `CLIENT_ENDPOINT` | Comma-separated allowed browser origins |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `MONGO_NO_ADMIN_RIGHTS` | `false` | Skip MongoDB admin operations when using restricted database credentials |
| `PROMETHEUS_USERNAME`, `PROMETHEUS_PASSWORD` | Unset | Basic-auth credentials for [metrics](apps/server/README.md#prometheus) |
| `CLIENT_ENDPOINT`, `API_ENDPOINT` | Required outside combined image | Browser-facing frontend and backend URLs for a source installation |
| `PORT` | `8080` | Backend listener for a source installation |

The Compose example sets `COOKIE_VALIDITY_MS=2592000000` for 30 days. Duration strings such as `1h` set token expiry, but only a numeric millisecond value sets the browser cookie's persistent lifetime.

Use `SPOTIFY_REQUEST_INTERVAL_MS` for this fork, not `SPOTIFY_API_DELAY_MS` from other image documentation. CORS usually needs no override. If you set it, list exact origins, for example `https://music.example.com,https://dashboard.example.com`, without paths or trailing slashes. An explicit default port such as `:443` may not match the browser's normalized origin.

## History imports

The app polls Spotify for recent listening activity after registration. This does not retrieve your entire past history. Request an export from [Spotify account privacy](https://www.spotify.com/account/privacy/), then open **Settings → Account → Import data**:

- **Account data:** select `StreamingHistory*.json` files, generally covering the past year.
- **Extended streaming history:** select `Streaming_History_Audio_*.json` files for the longer history provided by Spotify. This is the recommended format.

Spotify controls export availability and delivery time. Upload the extracted JSON files, not the ZIP archive.

Choose **Start now** or **Schedule for later**. The schedule uses your browser's local time and initially suggests the next 02:00. Files are uploaded immediately; the server stores the job in MongoDB and checks for due jobs at startup and every 30 seconds. A due job can wait if that user already has an import running.

**Restart behavior matters:**

- A still-pending scheduled job survives a restart if both MongoDB and `/tmp/imports` are preserved. An overdue pending job can start after the server returns.
- A job that was starting or running is marked failed after a server restart. It does not resume automatically. Use **Retry** in import history; its files must still exist.
- **Cancel scheduled import** applies only to pending jobs and removes their uploaded files. Cleaning up a failed import removes its uploaded files, so retry it before cleaning up if you still need it.

API errors or exhausted retries can also fail an import. Duplicate detection reduces overlap, but duplicates can still occur. See the [scheduler](apps/server/src/tools/importers/scheduler.ts) and [import lifecycle](apps/server/src/tools/importers/importer.ts) for implementation details.

## Troubleshooting

**Spotify asks the app to pause.** Bulk requests wait for the recorded cooldown. Login uses its own queue, but if Spotify returns a real `429` there too, the app reports a retry time. Wait, then begin a fresh sign-in rather than refreshing an old callback. Restarting the container or deleting the cooldown file does not reset Spotify's quota.

**Login fails or the browser cannot retrieve global preferences.** Check `APP_URL`, the registered redirect URI, and reverse-proxy routing to `/api`. In a source installation, `API_ENDPOINT` must reach the backend from the user's browser, not point to the frontend. Check explicit CORS origins if configured.

**Listening history stops updating.** If Spotify access was revoked, use **Reconnect** under **Spotify connection** in Settings. Check server logs for API errors and cooldowns.

**An import is missing files or cannot start.** Check that `/tmp/imports` is mounted persistently and writable by the container's UID/GID. Also check free disk space and proxy upload limits. Running jobs interrupted by a restart need a manual retry.

**Statistics use the wrong timezone.** Change your timezone in Settings. `TIMEZONE` is the server-side default; history timestamps and other local displays use the device timezone. Stored timestamps remain UTC.

## Development

Use Node.js 24 and pnpm 10.17.1, matching the [Dockerfile](Dockerfile) and CI:

```sh
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

To run from source, provide MongoDB and export the server environment variables, including `CLIENT_ENDPOINT`, `API_ENDPOINT`, and the Spotify credentials. Run `pnpm --filter @onrecord/server migrate`, then `pnpm --filter @onrecord/server start`.

Serve `apps/client/build` as a static site with unknown routes falling back to `index.html`. Copy `variables-template.js` to `variables.js` in that directory and replace `__API_ENDPOINT__` with the public backend URL. A directly exposed backend uses `/oauth/spotify/callback`; `/api/oauth/spotify/callback` is for a proxy that mounts the backend under `/api`.

[LOCAL_INSTALL.md](LOCAL_INSTALL.md) contains inherited hosting and systemd notes. Its Yarn, Node 16, and `lib/bin/www` commands are legacy; use the commands and `build/index.js` entry point above for this fork.

## Support and credits

Report fork bugs and feature requests in [aserper/OnRecord issues](https://github.com/aserper/OnRecord/issues). Include the image digest or commit, relevant configuration with secrets removed, and redacted logs.

- **Upstream project and support:** [Yooooomi/your_spotify](https://github.com/Yooooomi/your_spotify) and [upstream issues](https://github.com/Yooooomi/your_spotify/issues). Please report fork-specific problems here first.
- **Container foundation:** [LinuxServer Your Spotify](https://github.com/linuxserver/docker-your_spotify).
- **License:** [GNU GPL v3](LICENSE), retained from upstream.
