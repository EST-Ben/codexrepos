# Production Deployment Guide

This document walks through the productionization targets from Stage 5:

1. **Host the FastAPI backend** behind a reverse proxy or managed container service.
2. **Publish the Expo application** as a static web bundle.
3. **Generate mobile binaries** with EAS build pipelines.
4. **Automate releases** so tagging the repository ships the API and web bundle and triggers mobile
   builds.

---

## 1. Backend hosting

### Option A – Virtual machine (Uvicorn + Nginx)

1. Provision an Ubuntu LTS VM (e.g., AWS Lightsail, EC2 t3.small, Azure B-series).
2. Install Docker Engine and pull the API image produced by the release workflow:
   ```bash
   docker login ghcr.io
   docker pull ghcr.io/<org>/<repo>/api:<tag>
   ```
3. Create an `.env` file on the server with production values:
   ```bash
   ENVIRONMENT=production
   ALLOWED_ORIGINS=https://app.yourdomain.com,https://console.yourdomain.com
   UPLOAD_DIR=/var/lib/diagnostics/uploads
   ```
4. Launch the container with Uvicorn bound to localhost and managed by systemd:
   ```bash
   docker run --env-file .env --name diagnostics-api -p 127.0.0.1:8000:8000 \
     -v /var/lib/diagnostics/uploads:/var/lib/diagnostics/uploads \
     -d ghcr.io/<org>/<repo>/api:<tag>
   ```
5. Install Nginx and create a reverse proxy block that forwards `https://api.yourdomain.com` to
   `http://127.0.0.1:8000`. Enable gzip and TLS via Let’s Encrypt (Certbot) for production security.

### Option B – Managed container (Azure Web App / AWS App Runner)

1. Ensure the GitHub release workflow pushes images to GHCR (already configured).
2. Create the managed container resource and point it at the GHCR image URL
   (`ghcr.io/<org>/<repo>/api:<tag>`).
3. Inject environment variables in the hosting control plane:
   - `ENVIRONMENT=production`
   - `ALLOWED_ORIGINS=https://app.yourdomain.com`
   - `UPLOAD_DIR=/tmp/uploads` (each platform provides a writable temp directory)
4. Attach storage if you want uploads persisted across container restarts; otherwise use S3/Azure
   Blob and mount it via the platform’s volume features.

The Dockerfile in the repo packages the API with Uvicorn and sets `ENVIRONMENT=production` by default,
so you only need to override the allowed origins and storage paths at runtime.

---

## 2. Web app hosting

1. Export the static bundle locally or rely on the release workflow artifact:
   ```bash
   cd app
   npm install
   npm run export:web -- --output-dir ../dist/web
   ```
2. Upload the `dist/web` contents to your static host of choice:
   - **S3 + CloudFront** – mirror the release workflow by syncing to S3 and invalidating CloudFront.
   - **Netlify/Vercel** – drag the folder in the UI or point the service at a CI artifact.
3. Update `app/app.json` and/or environment variables so `expo.extra.API_URL` points at your public
   API (e.g., `https://api.yourdomain.com`).

---

## 3. Mobile builds (EAS)

1. Install and authenticate the EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Configure the project once (`eas build:configure` inside the `app/` directory).
3. Build production clients from Windows or via the release workflow (requires `EAS_TOKEN`):
   ```bash
   eas build -p android --profile production
   eas build -p ios --profile production
   ```
4. The `app/app.json` file already declares camera and storage permissions for both platforms. Ensure
   the generated binaries land in your distribution channels (Google Play, TestFlight, etc.).

---

## 4. CI/CD pipeline

Two GitHub Actions workflows are included:

- `.github/workflows/ci.yml` runs on every push/PR. It type-checks the Expo app (`npx tsc --noEmit`) and
  executes the FastAPI test suite (`pytest`).
- `.github/workflows/release.yml` runs when you push a tag that starts with `v`. The job builds and
  pushes the Docker image to GHCR, exports the Expo web bundle, optionally deploys it to S3/CloudFront,
  and triggers EAS builds when secrets are configured.

### Required secrets

| Secret | Purpose |
| ------ | ------- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` | Deploy web bundle to S3 |
| `AWS_CLOUDFRONT_DISTRIBUTION` | (Optional) Cache invalidation after S3 sync |
| `EAS_TOKEN` | Auth token for `eas build --non-interactive` |

### Release process

1. Update the `CHANGELOG.md` with a new version entry.
2. Commit and push to `main`.
3. Tag the commit (e.g., `git tag v1.1.0 && git push origin v1.1.0`).
4. The release workflow publishes the API image, exports/upload the web bundle, and triggers EAS builds.

With these workflows in place, production deployment becomes a single `git tag` away.
