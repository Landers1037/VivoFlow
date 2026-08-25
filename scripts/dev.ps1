$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:CARGO_TARGET_DIR = Join-Path (Get-Location) "target"

$busy = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "Port 8787 is already in use."
    Write-Host "Stop the production binary (target/release/vivoflow.exe) first, then retry."
    exit 1
}

Write-Host "==> Starting Rust backend: cargo run -p vivoflow"
$backendCommand = "`$env:CARGO_TARGET_DIR = '$($env:CARGO_TARGET_DIR)'; cargo run -p vivoflow"
Start-Process powershell -WorkingDirectory (Get-Location) -ArgumentList @(
    "-NoExit",
    "-Command",
    $backendCommand
)

Write-Host "==> Starting Vite dev server"
Write-Host "This PC:  http://127.0.0.1:5173"
Write-Host "Phone:    http://<LAN-IP>:5173  (same Wi-Fi; API/WS proxy to 8787)"
Write-Host "Ctrl+C stops Vite. Close the other window to stop the backend."
Write-Host ""

Push-Location web
try {
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npm run dev
}
finally {
    Pop-Location
}
