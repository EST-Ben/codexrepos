# --- builder ---
FROM python:3.11-slim AS builder
WORKDIR /app
ENV PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*
COPY server/requirements.txt server/requirements.txt
RUN python -m venv /venv && /venv/bin/pip install -U pip && /venv/bin/pip install -r server/requirements.txt

# --- runtime ---
FROM python:3.11-slim
ENV PATH="/venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN useradd -m appuser
COPY --from=builder /venv /venv
COPY server/ server/
COPY config/ config/
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
