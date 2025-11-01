@echo off
setlocal ENABLEDELAYEDEXPANSION

set "REPO_ROOT=%~dp0"

if /I "%~1"=="--dev-client" (
  set "DEV_CLIENT=1"
  shift
)

pushd "%REPO_ROOT%app" || exit /b 1

if not defined API_URL (
  set "API_URL=http://localhost:8000"
)
if not defined EXPO_PUBLIC_API_URL (
  set "EXPO_PUBLIC_API_URL=%API_URL%"
)

set "__CHECK_PLACEHOLDER=%EXPO_PUBLIC_API_URL:<=%"
set "__CHECK_PLACEHOLDER=%__CHECK_PLACEHOLDER:>=%"
if not "%__CHECK_PLACEHOLDER%"=="%EXPO_PUBLIC_API_URL%" (
  echo.
  echo [ERROR] API URL still contains a ^<LAN-IP^> placeholder. Replace it with your LAN address or http://localhost:8000.
  popd
  endlocal
  exit /b 1
)

set "__CHECK_PLACEHOLDER="

if defined EXPO_USE_DEV_CLIENT if not defined DEV_CLIENT (
  set "DEV_CLIENT=1"
)

if defined DEV_CLIENT (
  set "EXPO_USE_DEV_CLIENT=1"
)

echo.
echo === Expo mobile app ===
echo Using API URL: %EXPO_PUBLIC_API_URL%
echo.

npx --yes expo install expo-image-picker
if errorlevel 1 goto :end

if defined DEV_CLIENT (
  npx --yes expo start --dev-client --lan -c
) else (
  npx --yes expo start --lan -c
)

:end
popd
endlocal
