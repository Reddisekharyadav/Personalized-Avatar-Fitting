# Install 3D dependencies for SMPLX model generation
# Run this once to set up the API environment for 3D mode

Write-Host "Installing 3D ML dependencies..." -ForegroundColor Green

# Install PyTorch (CPU version - smaller and faster to install)
Write-Host "`nInstalling PyTorch..." -ForegroundColor Yellow
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install SMPLX, trimesh, and deepface
Write-Host "`nInstalling smplx, trimesh, deepface..." -ForegroundColor Yellow
pip install smplx trimesh deepface

Write-Host "`n✅ 3D dependencies installed!" -ForegroundColor Green
Write-Host "Now run: .\start-api-3d.ps1 to start the API with 3D mode enabled" -ForegroundColor Cyan
