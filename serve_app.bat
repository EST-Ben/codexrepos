@echo off
setlocal ENABLEDELAYEDEXPANSION

set "REPO_ROOT=%~dp0"
pushd "%REPO_ROOT%app" || exit /b 1

if not defined API_URL (
  set "API_URL=http://localhost:8000"
)
if not defined EXPO_PUBLIC_API_URL (
  set "EXPO_PUBLIC_API_URL=%API_URL%"
)

echo.
echo === Expo mobile app ===
echo Using API URL: %EXPO_PUBLIC_API_URL%
echo.

npx --yes expo install expo-image-picker
if errorlevel 1 goto :end

npx expo start --lan -c

:end
popd
endlocal
