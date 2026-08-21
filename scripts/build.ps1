$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:CARGO_TARGET_DIR = Join-Path (Get-Location) "target"

Write-Host "==> Building web/"
Push-Location web
npm install
npm run build
Pop-Location

Write-Host "==> Syncing web/dist -> crates/vivoflow/static"
$staticDir = "crates/vivoflow/static"
if (Test-Path $staticDir) { Remove-Item -Recurse -Force $staticDir }
New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
Copy-Item -Recurse -Force "web/dist/*" $staticDir

Write-Host "==> Building vivoflow (release)"
cargo build -p vivoflow --release

Write-Host ""
Write-Host "Done: target/release/vivoflow.exe"
Write-Host "Run:  .\target\release\vivoflow.exe"
Write-Host "Open: http://<LAN-IP>:8787"
