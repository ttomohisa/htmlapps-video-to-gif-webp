@echo off
setlocal
if "%~1"=="" (
  echo Usage: build-standalone-local.bat ^<FFmpeg Builder dist folder^>
  echo Example: build-standalone-local.bat ..\htmlapps-ffmpeg-wasm-builder-main\dist
  exit /b 2
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-standalone.ps1" -LocalFfmpegDist "%~1"
exit /b %ERRORLEVEL%
