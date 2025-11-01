# Changelog

## Unreleased

- Hardened Expo launch scripts to catch placeholder API URLs before Metro starts, eliminating the
  common "Failed to parse URL" startup error on Windows.
- Documented high-frequency setup issues in `LOCAL_DEV.md`, including `/api` router checks, CORS
  guidance, Expo dependency alignment, and `PYTHONPATH` fixes for manual Uvicorn runs.

## v1.1.0 - 2025-11-01

- Added environment-aware CORS configuration with production origin allowlists and committed a default
  `.env` template for local overrides.
- Introduced containerized API deployment via a new Dockerfile and GitHub Actions workflows that build
  Docker images, export the Expo web bundle, and push artifacts on tagged releases.
- Documented production hosting paths (VM, managed container, static web hosting, and EAS builds) in
  `DEPLOYMENT.md` and linked the checklist from the README and Windows setup guide.
- Extended Expo configuration for production: explicit camera/storage permissions, a reusable web export
  script, and guidance on environment configuration across app targets.

