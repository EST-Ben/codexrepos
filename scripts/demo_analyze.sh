#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_DIR="$ROOT/sample_images"
IMAGE_PATH="$IMAGE_DIR/stringing.jpg"

if [ ! -f "$IMAGE_PATH" ]; then
  mkdir -p "$IMAGE_DIR"
  python - "$IMAGE_PATH" <<'PY'
import base64
import pathlib
import sys

DATA = b"/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhIRExIVFhUVFRUVFRUVFRUVFRUVFRUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lICYtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAAFAAEDBAYCB//EAD8QAAIBAgQDBgQEBQMFAQAAAAECAAMRBBIhMQVBUQYiYXGBEzKRobHB0RQjQlJicuHwFyMzgpLxFSRTY3ODw9L/xAAZAQEAAwEBAAAAAAAAAAAAAAAAAgMEAQX/xAAkEQEAAgIBBAEFAAAAAAAAAAAAAQIRAyEEEjFBIlETFEKBsf/aAAwDAQACEQMRAD8A+lERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQE//Z"
path = pathlib.Path(sys.argv[1])
path.write_bytes(base64.b64decode(DATA))
print(f"Wrote sample image to {path}")
PY
fi

API_URL="${API_URL:-http://localhost:8000}"
META='{"machine_id":"bambu_p1s","experience":"Intermediate","material":"PLA"}'

echo "Uploading sample analysis to $API_URL" >&2
curl -sS -X POST "$API_URL/api/analyze" \
  -F "image=@${IMAGE_PATH}" \
  -F "meta=${META}" | python -m json.tool
