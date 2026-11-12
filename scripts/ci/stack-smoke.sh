#!/usr/bin/env bash
# Runs the real app image twice (app and worker) with the hardened settings of deploy/stack-site.yml
# (--cap-drop ALL, no-new-privileges, 768m memory, cpu-shares 512, capped Node heap) in front of a real
# postgres:16-alpine on a dedicated network. The worker must log "[worker] started" and the app container
# must become "healthy" (same healthcheck as the stack) within 2 minutes.
# Usage: bash scripts/ci/stack-smoke.sh <image>      Throwaway values only: nothing here is a secret.
set -euo pipefail

image="${1:?usage: stack-smoke.sh <image>}"
id="psn-stack-$$"
net="$id-net"
db="$id-db"
app="$id-app"
worker="$id-worker"
media="$id-media"
deadline_s=120

cleanup() {
  docker rm -f "$app" "$worker" "$db" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  docker volume rm "$media" >/dev/null 2>&1 || true
}
trap cleanup EXIT

dump_logs() {
  echo "--- app logs ---" >&2
  docker logs "$app" >&2 2>&1 || true
  echo "--- worker logs ---" >&2
  docker logs "$worker" >&2 2>&1 || true
  echo "--- end ---" >&2
}

fail() {
  echo "FAIL - $1" >&2
  dump_logs
  exit 1
}

docker network create "$net" >/dev/null
# A new named volume copies /data/media from the image: owned by uid 1000 (node), like the NAS folder.
docker volume create "$media" >/dev/null

docker run -d --name "$db" --network "$net" --network-alias postgres \
  -e POSTGRES_USER=psn -e POSTGRES_PASSWORD=psn -e POSTGRES_DB=psn \
  --health-cmd "pg_isready -U psn -d psn" --health-interval 2s --health-timeout 5s --health-retries 30 \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$db")" = "healthy" ] && break
  sleep 1
done
if [ "$(docker inspect -f '{{.State.Health.Status}}' "$db")" != "healthy" ]; then
  echo "FAIL - postgres never became healthy" >&2
  docker logs "$db" >&2 2>&1 || true
  exit 1
fi
echo "ok - postgres is healthy"

# Exactly the settings of deploy/stack-site.yml.
hardening=(
  --network "$net"
  --cap-drop ALL
  --security-opt no-new-privileges:true
  --memory 768m
  --cpu-shares 512
  -e NODE_OPTIONS=--max-old-space-size=576
  -e DATABASE_URL=postgres://psn:psn@postgres:5432/psn
  -e ADMIN_USERNAME=ci
  -e ADMIN_PASSWORD_HASH=ci-not-a-real-hash
  -e APP_SECRET=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
  -e PSN_LANGUAGE=en-GB
  -e MEDIA_DIR=/data/media
  -e TZ=Europe/Paris
  -v "$media:/data/media"
)

# Same check as the healthcheck of the "app" service (2xx would be too lenient: only 200 is healthy).
health_js="require('http').get('http://127.0.0.1:3000/login', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

docker run -d --name "$worker" "${hardening[@]}" "$image" node dist/worker.js >/dev/null
docker run -d --name "$app" "${hardening[@]}" \
  --health-cmd "node -e \"$health_js\"" \
  --health-interval 5s --health-timeout 5s --health-retries 3 --health-start-period 30s \
  "$image" >/dev/null

started=0
healthy=0
SECONDS=0
while [ "$SECONDS" -lt "$deadline_s" ]; do
  if [ "$started" = 0 ] && docker logs "$worker" 2>&1 | grep -qF "[worker] started"; then
    started=1
    echo "ok - the worker logged [worker] started"
  fi
  if [ "$healthy" = 0 ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$app")" = "healthy" ]; then
    healthy=1
    echo "ok - the app container is healthy"
  fi
  [ "$started" = 1 ] && [ "$healthy" = 1 ] && exit 0
  for c in "$app" "$worker"; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$c")" != "true" ]; then
      fail "container $c exited (exit code $(docker inspect -f '{{.State.ExitCode}}' "$c"))"
    fi
  done
  sleep 2
done

fail "after ${deadline_s}s: worker started=$started, app healthy=$healthy"
