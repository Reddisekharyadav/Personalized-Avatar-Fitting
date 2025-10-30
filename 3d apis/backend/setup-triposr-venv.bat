@echo off
REM TripoSR Setup with Virtual Environment (Most Reliable)
REM This creates an isolated Python environment to avoid conflicts

echo ========================================
echo   TripoSR Setup with Virtual Env
echo   (Recommended - Avoids Conflicts)
echo ========================================
echo.

REM Check Python
echo [1/7] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found!
    echo Please install Python 3.8 or higher from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)

python --version
echo.

REM Create main directory
echo [2/7] Setting up directories...
if not exist "triposr-local" mkdir triposr-local
cd triposr-local

REM Create virtual environment
echo [3/7] Creating Python virtual environment...
echo This ensures packages are installed in the right place.
python -m venv venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    echo Try: python -m pip install --upgrade pip
    pause
    exit /b 1
)

REM Activate virtual environment
echo [4/7] Activating virtual environment...
call venv\Scripts\activate.bat

REM Clone TripoSR
echo [5/7] Downloading TripoSR...
if not exist "TripoSR" (
    git clone https://github.com/VAST-AI-Research/TripoSR.git
    if %errorlevel% neq 0 (
        echo ERROR: Failed to clone repository
        echo Make sure git is installed: https://git-scm.com/
        pause
        exit /b 1
    )
) else (
    echo TripoSR already downloaded, skipping...
)

REM Upgrade pip
echo [6/7] Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo [7/7] Installing dependencies (3-5 minutes)...
echo.
echo Installing PyTorch (CPU version - works on all computers)...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo.
echo Installing core packages...
pip install numpy pillow omegaconf einops transformers huggingface_hub

echo.
echo Installing mesh tools...
pip install imageio trimesh

echo.
echo Installing torchmcubes...
pip install git+https://github.com/tatsy/torchmcubes.git
if %errorlevel% neq 0 (
    echo WARNING: torchmcubes failed - model may be slower
    echo This is OK, continuing...
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo Virtual environment created at:
echo %CD%\venv
echo.
echo TripoSR installed at:
echo %CD%\TripoSR
echo.
echo To use TripoSR, the virtual environment will be
echo activated automatically by the Node.js integration.
echo.
echo Next steps:
echo 1. Test it: cd ..\.. ^&^& node test-triposr-local.js
echo 2. Start generating 3D models for FREE!
echo.
pause
