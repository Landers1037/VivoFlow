#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building web/"
(cd web && npm install && npm run build)

echo "==> Syncing web/dist -> crates/vivoflow/static"
rm -rf crates/vivoflow/static
mkdir -p crates/vivoflow/static
cp -R web/dist/. crates/vivoflow/static/

echo "==> Installing local agent bridge dependencies"
(cd agent && npm ci --omit=dev)

echo "==> Building vivoflow (release)"
cargo build -p vivoflow --release

echo "==> Bundling local agent bridge"
rm -rf target/release/agent
mkdir -p target/release/agent
cp -R agent/. target/release/agent/

echo ""
echo "Done: target/release/vivoflow"
echo "Run:  ./target/release/vivoflow"
echo "Open: http://<LAN-IP>:8787"
