#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v ss >/dev/null 2>&1 && ss -ltn | grep -q ':8787'; then
  echo "Port 8787 is already in use."
  echo "Stop the production binary first, then retry."
  exit 1
fi

echo "==> Starting Rust backend: cargo run -p vivoflow"
cargo run -p vivoflow &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM

echo "==> Starting Vite dev server"
echo "This PC:  http://127.0.0.1:5173"
echo "Phone:    http://<LAN-IP>:5173  (same Wi-Fi; API/WS proxy to 8787)"
echo ""

cd web
if [ ! -d node_modules ]; then
  npm install
fi
npm run dev
