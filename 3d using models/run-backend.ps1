Param(
  [string]$Broker = "redis://localhost:6379/0",
  [int]$Port = 8001,
  [switch]$Web
)

# Resolve important paths
$ScriptRoot = $PSScriptRoot
$RepoRoot = Split-Path $ScriptRoot -Parent
$ApiDir = Join-Path $ScriptRoot "services\api"
$MlDir = Join-Path $ScriptRoot "services\ml"
$WebDir = Join-Path $ScriptRoot "apps\web"

# Resolve Python executable: prefer an activated venv, else repo venv, else system
if ($env:VIRTUAL_ENV) {
  $Python = Join-Path $env:VIRTUAL_ENV "Scripts\python.exe"
} elseif (Test-Path (Join-Path $RepoRoot "venv\Scripts\python.exe")) {
  $Python = Join-Path $RepoRoot "venv\Scripts\python.exe"
} else {
  $Python = "python"
}

Write-Host "Using Python:" $Python -ForegroundColor Cyan
Write-Host "API Dir:" $ApiDir
Write-Host "ML Dir:" $MlDir
Write-Host "Broker:" $Broker

# Start Celery worker in a new PowerShell window
$mlCmd = "cd `"$MlDir`"; $env:REDIS_URL = `"$Broker`"; & `"$Python`" -m celery -A celery_app:celery worker -Q ml_queue -l info"
Start-Process powershell -ArgumentList @('-NoExit','-Command', $mlCmd) | Out-Null
Write-Host "Started Celery worker window." -ForegroundColor Green

# Start Uvicorn API in another PowerShell window
$apiCmd = "cd `"$ApiDir`"; $env:CELERY_BROKER_URL = `"$Broker`"; & `"$Python`" -m uvicorn main:app --reload --host 0.0.0.0 --port $Port"
Start-Process powershell -ArgumentList @('-NoExit','-Command', $apiCmd) | Out-Null
Write-Host "Started API (Uvicorn) window on port $Port." -ForegroundColor Green

if ($Web) {
  if (Test-Path (Join-Path $WebDir "package.json")) {
    $webCmd = "cd `"$WebDir`"; npm run dev"
    Start-Process powershell -ArgumentList @('-NoExit','-Command', $webCmd) | Out-Null
    Write-Host "Started Web (Next.js) window." -ForegroundColor Green
  } else {
    Write-Warning "Web app folder not found at $WebDir or no package.json present. Skipping web startup."
  }
}

Write-Host "All requested processes started. Ensure Redis is running at $Broker." -ForegroundColor Yellow