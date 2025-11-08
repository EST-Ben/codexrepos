// server-node/src/index.ts
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { performance } from "node:perf_hooks";
import { analyzeImageRoute } from "./routes/analyze-image.js";
import { analyzeJsonRoute } from "./routes/analyze-json.js";
import { machinesRoute } from "./routes/machines.js";
import { exportProfileRoute } from "./routes/export.js";
import { settings } from "./settings.js";
import { DebugSnapshotSchema, HealthResponseSchema } from "./schemas.js";
import type { DebugSnapshot } from "types/api";

// --------------------------- CORS helpers ---------------------------
function normalizeOrigins(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  return String(input)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Build the effective CORS allowlist.
 * - Always includes common Expo web dev origins.
 * - Merges settings.allowedOrigins and env ALLOWED_ORIGINS (comma-separated).
 */
function buildCorsAllowlist(): string[] {
  const DEFAULT_DEV = [
    "http://localhost:8081",   // Expo web
    "http://127.0.0.1:8081",
    "http://localhost:19006",  // Expo web (alternate)
    "http://127.0.0.1:19006",
  ];

  const fromSettings = normalizeOrigins((settings as any).allowedOrigins);
  const fromEnv = normalizeOrigins(process.env.ALLOWED_ORIGINS);

  // Also accept a dynamic WEB_PORT (if someone runs Expo with a different port)
  const maybeWeb = process.env.WEB_PORT ? `http://localhost:${process.env.WEB_PORT}` : null;

  const all = new Set<string>([...DEFAULT_DEV, ...fromSettings, ...fromEnv]);
  if (maybeWeb) all.add(maybeWeb);

  return Array.from(all);
}

// --------------------------- request stats ---------------------------
const requestStats = {
  total: 0,
  perRoute: new Map<string, { count: number; last: number }>(),
};

function snapshotRoutes() {
  const perRoute: Record<string, { count: number; last_request_ts: string | null }> = {};
  for (const [route, meta] of requestStats.perRoute.entries()) {
    perRoute[route] = {
      count: meta.count,
      last_request_ts: meta.last ? new Date(meta.last).toISOString() : null,
    };
  }
  return perRoute;
}

export async function createServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      base: { service: "codexrepo-api" },
    },
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // --------------------------- security & basics ---------------------------
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // CORS — allow Expo web localhost + configured allowlists.
  const allowlist = buildCorsAllowlist();
  await app.register(cors, {
    // Dynamic function so we can allow native (no Origin) and exact allowlist matches.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // native app / curl / server-to-server
      if (allowlist.includes(origin)) return cb(null, true);
      // Helpful log for local dev
      app.log.warn({ origin }, "CORS blocked origin");
      cb(new Error("CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.log.info({ allowlist }, "CORS allowlist configured");

  await app.register(multipart, {
    limits: { fileSize: settings.uploadMaxBytes, files: 1 },
  });

  await app.register(rateLimit, {
    max: settings.rateLimit.requests,
    timeWindow: `${settings.rateLimit.windowSeconds}s`,
  });

  // --------------------------- Swagger / OpenAPI ---------------------------
  const swaggerServer =
    process.env.SWAGGER_SERVER ??
    `http://localhost:${process.env.PORT ?? 8000}`;

  await app.register(swagger, {
    openapi: {
      info: { title: "Diagnostics API", version: settings.version },
      servers: [{ url: swaggerServer }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
    staticCSP: true,
  });

  // --------------------------- instrumentation ---------------------------
  app.addHook("onRequest", async (request, _reply) => {
    (request as any)._diagnosticStart = performance.now();
    const cl = Number(request.headers["content-length"] ?? 0);
    if (cl && cl > settings.uploadMaxBytes) {
      const err = new Error("Payload too large");
      (err as any).statusCode = 413;
      throw err;
    }
  });

  app.addHook("onResponse", (request, reply, done) => {
    const routeKey = request.routeOptions.url ?? request.raw.url ?? "unknown";
    const start = (request as any)._diagnosticStart;
    const durationMs =
      typeof start === "number" ? Number((performance.now() - start).toFixed(2)) : undefined;

    requestStats.total += 1;
    const entry = requestStats.perRoute.get(routeKey) ?? { count: 0, last: 0 };
    entry.count += 1;
    entry.last = Date.now();
    requestStats.perRoute.set(routeKey, entry);

    request.log.info({ route: routeKey, statusCode: reply.statusCode, durationMs }, "request completed");
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as any).statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled error");
    }
    const message =
      statusCode >= 500 ? "Internal server error" : (error as any).message ?? "Request failed";
    reply.status(statusCode).send({ error: message });
  });

  // --------------------------- routes ---------------------------
  app.get(
    "/health",
    {
      schema: {
        tags: ["ops"],
        response: { 200: HealthResponseSchema },
      },
    },
    async () => ({
      status: "ok",
      stub_inference: true,
      uptime_ms: Math.round(process.uptime() * 1000),
    }),
  );

  app.get(
    "/_debug",
    {
      schema: {
        tags: ["ops"],
        response: { 200: DebugSnapshotSchema },
      },
    },
    async () => {
      const memory = process.memoryUsage();
      const snapshot: DebugSnapshot = {
        status: "ok",
        env: settings.env,
        version: settings.version,
        timestamp: new Date().toISOString(),
        uptime_ms: Math.round(process.uptime() * 1000),
        rate_limit: settings.rateLimit,
        upload_max_mb: Math.round((settings.uploadMaxBytes / (1024 * 1024)) * 100) / 100,
        memory: {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
        },
        request_counters: {
          total: requestStats.total,
          per_route: snapshotRoutes(),
        },
      };
      return snapshot;
    },
  );

  // Existing feature routes (prefix /api)
  await app.register(analyzeImageRoute, { prefix: "/api" });
  await app.register(analyzeJsonRoute, { prefix: "/api" });
  await app.register(machinesRoute, { prefix: "/api" });
  await app.register(exportProfileRoute, { prefix: "/api" });

  return app;
}
