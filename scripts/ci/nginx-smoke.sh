#!/usr/bin/env bash
# Runs the real deploy/nginx/default.conf in the real nginx image in front of a stub app and checks
# that JSON is gzipped and that a forged X-Forwarded-For cannot choose the client address.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
id="psn-smoke-$$"
net="$id-net"
app="$id-app"
proxy="$id-nginx"
curl_image="curlimages/curl:8.11.1"

cleanup() {
  docker rm -f "$app" "$proxy" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Fixed subnet inside 172.16.0.0/12, the range the config trusts.
docker network create --subnet 172.29.250.0/24 "$net" >/dev/null

docker run -d --name "$app" --network "$net" --network-alias app \
  -v "$root/scripts/ci/stub-app.mjs:/stub-app.mjs:ro" \
  node:22-alpine node /stub-app.mjs >/dev/null

docker run -d --name "$proxy" --network "$net" \
  -v "$root/deploy/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine >/dev/null

docker exec "$proxy" nginx -t
echo "ok - nginx -t accepts deploy/nginx/default.conf"

# Pull the curl image explicitly so a failed pull fails at once with a clear message.
if ! docker pull "$curl_image" >/dev/null; then
  echo "FAIL - could not pull $curl_image"
  exit 1
fi

fetch() { docker run --rm --network "$net" "$curl_image" -sS "$@"; }

# Runs a check's curl call; if curl itself fails (transport error), prints a FAIL line with what
# was received instead of letting set -e abort silently.
fetch_or_fail() {
  local label="$1"; shift
  local out
  if ! out="$(fetch "$@" 2>&1)"; then
    echo "FAIL - $label: the request itself failed, received: $out"
    exit 1
  fi
  printf '%s' "$out"
}

ready=0
for _ in $(seq 1 30); do
  code="$(fetch -o /dev/null -w '%{http_code}' "http://$proxy/ip" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "FAIL - http://$proxy/ip never answered 200 (last status: ${code:-none})"
  docker logs "$proxy" || true
  docker logs "$app" || true
  exit 1
fi
echo "ok - nginx answers through to the stub app"

headers="$(fetch_or_fail "/big.json" -o /dev/null -D - -H 'Accept-Encoding: gzip' "http://$proxy/big.json")"
if ! printf '%s\n' "$headers" | grep -qi '^content-encoding: gzip'; then
  echo "FAIL - /big.json is not gzipped; headers received:"
  printf '%s\n' "$headers"
  exit 1
fi
echo "ok - JSON is gzipped"

headers10="$(fetch_or_fail "/big.json over HTTP/1.0" --http1.0 -o /dev/null -D - -H 'Accept-Encoding: gzip' "http://$proxy/big.json")"
if ! printf '%s\n' "$headers10" | grep -qi '^content-encoding: gzip'; then
  echo "FAIL - /big.json is not gzipped for an HTTP/1.0 request; headers received: $headers10"
  exit 1
fi
echo "ok - JSON is gzipped for an HTTP/1.0 request"

body="$(fetch_or_fail "/ip" -H 'X-Forwarded-For: 203.0.113.9, 192.168.1.50' "http://$proxy/ip")"
case "$body" in
  *'"realIp":"192.168.1.50"'*) echo "ok - a forged X-Forwarded-For does not win (got 192.168.1.50)" ;;
  *) echo "FAIL - expected \"realIp\":\"192.168.1.50\", received: $body"; exit 1 ;;
esac
