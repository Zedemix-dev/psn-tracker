# syntax=docker/dockerfile:1

# ---- build: install, test, build the app, bundle the worker ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test
RUN npm run build
# PGlite (dev/test only) stays external: it is never loaded in production.
RUN npx esbuild src/worker/index.ts --bundle --platform=node --target=node22 \
    --external:@electric-sql/pglite --outfile=dist/worker.js

# ---- runtime: one image, two commands (app: default; worker: node dist/worker.js) ----
FROM node:22-alpine AS runtime
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
COPY --from=build --chown=node:node /app/src/db/migrations ./migrations

RUN mkdir -p /data/media && chown node:node /data/media
USER node
EXPOSE 3000
CMD ["node", "server.js"]
