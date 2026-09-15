FROM node:24-bookworm-slim AS build

WORKDIR /src
RUN npm install --global pnpm@10.17.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/dev/package.json apps/dev/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @your_spotify/client build \
 && pnpm --filter @your_spotify/server build

FROM lscr.io/linuxserver/your_spotify@sha256:34f592ef352cce88db8f64ca502d646b17aa2ecd6076df47e053241b0dbef2da

COPY --from=build --chown=abc:abc /src/apps/client/build/ /app/www/apps/client/build/
COPY --from=build --chown=abc:abc /src/apps/server/build/ /app/www/apps/server/build/
