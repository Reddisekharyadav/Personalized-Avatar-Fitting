# Script to start API with 3D mode enabled
# This sets SMPLX model paths and starts uvicorn

$ML_MODELS_DIR = "C:\Users\reddi\mango\project\game for internship\virtualdressing\3d using models\services\ml\models"

# Set SMPLX model paths
$env:SMPLX_MALE_PATH = Join-Path $ML_MODELS_DIR "SMPLX_MALE.npz"
$env:SMPLX_FEMALE_PATH = Join-Path $ML_MODELS_DIR "SMPLX_FEMALE.npz"
$env:SMPLX_NEUTRAL_PATH = Join-Path $ML_MODELS_DIR "SMPLX_NEUTRAL.npz"

# Optional: Set Redis for other features
$env:CELERY_BROKER_URL = "redis://localhost:6379/0"
$env:CELERY_RESULT_BACKEND = "redis://localhost:6379/0"

Write-Host "Starting API with 3D mode enabled..." -ForegroundColor Green
Write-Host "SMPLX_MALE_PATH: $env:SMPLX_MALE_PATH" -ForegroundColor Cyan
Write-Host "SMPLX_FEMALE_PATH: $env:SMPLX_FEMALE_PATH" -ForegroundColor Cyan
Write-Host "SMPLX_NEUTRAL_PATH: $env:SMPLX_NEUTRAL_PATH" -ForegroundColor Cyan

# Start uvicorn
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
