#!/usr/bin/env bash
# Local PocketBase for development and tests. Never touches your live instance.
# Usage: npm run pb:dev            (downloads PocketBase 0.41.1 into .pb/ on first run)
#        PB_BIN=/path/to/pocketbase npm run pb:dev   (use a binary you already have)
set -euo pipefail
cd "$(dirname "$0")/.."

PB_VERSION="${PB_VERSION:-0.41.1}"
PB_PORT="${PB_PORT:-8090}"
PB_DIR=".pb"
DEV_EMAIL="${PB_DEV_EMAIL:-pm@example.com}"
DEV_PASSWORD="${PB_DEV_PASSWORD:-devpassword123}"
mkdir -p "$PB_DIR"

if [ -z "${PB_BIN:-}" ]; then
  PB_BIN="$PB_DIR/pocketbase"
  if [ ! -x "$PB_BIN" ]; then
    case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) echo "Unsupported OS" >&2; exit 1 ;; esac
    case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; arm64|aarch64) arch=arm64 ;; *) echo "Unsupported CPU" >&2; exit 1 ;; esac
    url="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${os}_${arch}.zip"
    echo "Downloading $url"
    curl -fsSL "$url" -o "$PB_DIR/pb.zip"
    unzip -o -q "$PB_DIR/pb.zip" pocketbase -d "$PB_DIR"
    rm "$PB_DIR/pb.zip"
  fi
fi

"$PB_BIN" superuser upsert "$DEV_EMAIL" "$DEV_PASSWORD" --dir "$PB_DIR/data" >/dev/null
echo "Superuser: $DEV_EMAIL / $DEV_PASSWORD"

"$PB_BIN" serve --http "127.0.0.1:$PB_PORT" --dir "$PB_DIR/data" --hooksDir ../pb_hooks &
PB_PID=$!
trap 'kill $PB_PID 2>/dev/null || true' EXIT INT TERM

for _ in $(seq 1 50); do
  curl -fsS "http://127.0.0.1:$PB_PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.2
done

PB_URL="http://127.0.0.1:$PB_PORT" PB_EMAIL="$DEV_EMAIL" PB_PASSWORD="$DEV_PASSWORD" node scripts/import-schema.mjs
echo "PocketBase running at http://127.0.0.1:$PB_PORT (dashboard at /_/). Ctrl+C to stop."
echo "Run the app against it with: VITE_PB_URL=http://127.0.0.1:$PB_PORT npm run dev"
wait $PB_PID
