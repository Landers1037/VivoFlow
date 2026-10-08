$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> Building web/"
Push-Location web
if (-not (Test-Path "node_modules")) {
    npm install
}
npm run build
Pop-Location

Write-Host "==> Syncing web/dist -> crates/vivoflow/static"
$staticDir = "crates/vivoflow/static"
if (Test-Path $staticDir) { Remove-Item -Recurse -Force $staticDir }
New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
Copy-Item -Recurse -Force "web/dist/*" $staticDir

Write-Host "==> Installing local agent bridge dependencies"
Push-Location agent
npm ci --omit=dev
Pop-Location

Write-Host "==> Staging agent resources for the desktop bundle"
$agentDest = "desktop/src-tauri/resources/agent"
if (Test-Path $agentDest) { Remove-Item -Recurse -Force $agentDest }
New-Item -ItemType Directory -Force -Path $agentDest | Out-Null
Copy-Item `
    "agent/index.mjs", `
    "agent/text.mjs", `
    "agent/package.json", `
    "agent/package-lock.json", `
    "agent/chattts_service.py", `
    "agent/requirements.txt" `
    $agentDest
Copy-Item -Recurse -Force "agent/node_modules" (Join-Path $agentDest "node_modules")

Write-Host "Desktop frontend and agent resources are ready."
