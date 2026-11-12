# syntax=docker/dockerfile:1

ARG SHARP_VERSION=0.35.5

# ---- build: install, build the app, bundle the worker (tests run in the CI test job) ----
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build # 22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# PGlite (dev/test only) stays external: it is never loaded in production.
# sharp stays external too: its native binary comes from the worker-deps stage.
RUN npx esbuild src/worker/index.ts --bundle --platform=node --target=node22 \
    --external:@electric-sql/pglite --external:sharp --outfile=dist/worker.js

# ---- worker-deps: sharp with its musl native binary, for the worker bundle ----
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS worker-deps # 22-alpine
ARG SHARP_VERSION
WORKDIR /deps
RUN npm install --omit=dev --no-audit --no-fund sharp@${SHARP_VERSION}

# ---- runtime: one image, two commands (app: default; worker: node dist/worker.js) ----
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS runtime # 22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MIGRATIONS_DIR=/app/migrations \
    MEDIA_DIR=/data/media

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist/worker.js ./dist/worker.js
COPY --from=worker-deps --chown=node:node /deps/node_modules ./dist/node_modules
COPY --from=build --chown=node:node /app/src/db/migrations ./migrations

RUN mkdir -p /data/media && chown node:node /data/media
# Fail the build if the native module does not load on Alpine/musl.
RUN node -e "require('/app/dist/node_modules/sharp')"
# The Plat Wall PNG route runs sharp and fontkit inside the Next app, through the
# Turbopack aliases in .next/node_modules: load them for real, as the route does.
COPY scripts/check-export-deps.cjs /tmp/check-export-deps.cjs
RUN node /tmp/check-export-deps.cjs /app && rm /tmp/check-export-deps.cjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
