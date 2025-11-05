# --- builder ---
FROM node:20-slim AS builder
WORKDIR /app
ENV npm_config_loglevel=warn
COPY server-node/package.json server-node/package.json
COPY server-node/package-lock.json server-node/package-lock.json
RUN npm --prefix server-node ci
COPY server-node server-node
COPY types types
COPY config config
RUN npm --prefix server-node run build

# --- runtime ---
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN useradd -m appuser
COPY --from=builder /app/server-node/package.json server-node/package.json
COPY --from=builder /app/server-node/node_modules server-node/node_modules
COPY --from=builder /app/server-node/dist server-node/dist
COPY --from=builder /app/config config
COPY --from=builder /app/types types
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
CMD ["node", "server-node/dist/index.js"]
