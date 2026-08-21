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

echo "==> Building vivoflow (release)"
cargo build -p vivoflow --release

echo ""
echo "Done: target/release/vivoflow"
echo "Run:  ./target/release/vivoflow"
echo "Open: http://<LAN-IP>:8787"
