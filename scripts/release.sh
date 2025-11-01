#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/web"
IMAGE_NAME=${IMAGE_NAME:-diagnostics-api}
IMAGE_TAG=${IMAGE_TAG:-latest}
REGISTRY=${REGISTRY:-ghcr.io}
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

pushd "$ROOT_DIR" >/dev/null

# Build the API image
if [[ "${SKIP_DOCKER:-0}" != "1" ]]; then
  echo "\nBuilding Docker image ${FULL_IMAGE}"
  docker build -t "$FULL_IMAGE" .
  if [[ "${PUSH_IMAGE:-0}" == "1" ]]; then
    echo "Pushing ${FULL_IMAGE}"
    docker push "$FULL_IMAGE"
  fi
fi

# Export the Expo web bundle
pushd app >/dev/null
npm install
npx expo export --platform web --output-dir "$DIST_DIR"
popd >/dev/null

if [[ -d "$DIST_DIR" ]]; then
  echo "\nWeb bundle available at $DIST_DIR"
fi

popd >/dev/null
