@echo off
setlocal enabledelayedexpansion

echo GLTF Preparation and Conversion Tool
echo ===================================
echo.

if "%1"=="" (
  echo Usage: prepare-and-convert.bat [directory]
  echo.
  echo If directory is not specified, the current directory will be used.
  set "TARGET_DIR=%CD%"
) else (
  set "TARGET_DIR=%~1"
)

echo Searching for GLTF files in: %TARGET_DIR%
echo.

set "FOUND=0"
for /F "delims=" %%F in ('dir /B /S "%TARGET_DIR%\*.gltf"') do (
  set /a FOUND+=1
  echo Found: %%F
  
  echo Preparing and converting to: %%~dpnF.glb
  cd %~dp0..
  node scripts\prepare-gltf.js "%%F" "%%~dpnF.glb"
  echo.
)

if %FOUND%==0 (
  echo No GLTF files found in the specified directory.
) else (
  echo Conversion complete! Processed %FOUND% files.
)

endlocal