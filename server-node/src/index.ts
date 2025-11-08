import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
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

/** ---------- Request stats (for /_debug) ---------- */
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

/** ---------- Small helpers ---------- */
function splitCsv(input?: string | null): string[] {
  if (!input) return [];
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Build an ARRAY of allowed origins (strings/regex) to avoid function-typed CORS,
 * which silences the TS overload error while still giving you flexible dev CORS. */
function buildAllowedOriginValues(): (string | RegExp)[] {
  const fromSettings = Array.isArray((settings as any).allowedOrigins)
    ? ((settings as any).allowedOrigins as string[])
    : [];

  const fromEnv = splitCsv(process.env.ALLOWED_ORIGINS);

  // Common dev hosts (Expo web uses 8081 by default)
  const defaults = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8081",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8081",
  ];

  // If you pass a LAN host/port, add it explicitly
  const lanHost = process.env.EXPO_DEV_SERVER_HOST || process.env.LAN_HOST;
  const lanWebPort = process.env.WEB_PORT || "8081";
  const lanExact = lanHost ? [`http://${lanHost}:${lanWebPort}`] : [];

  // Allow any 192.168.x.x during dev
  const lanRegex = [/^http:\/\/192\.168\.\d+\.\d+(?::\d+)?$/i];

  // De-dup strings, then append regex
  const strings = Array.from(new Set([...fromSettings, ...fromEnv, ...defaults, ...lanExact]));
  return [...strings, ...lanRegex];
}

/** ---------- Server factory ---------- */
export async function createServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      base: { service: "codexrepo-api" },
    },
    genReqId: () => randomUUID(),
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  /** Security headers (CSP off for dev/Swagger) */
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  /** CORS (array-based origin to satisfy types) */
  const allowedOrigins = buildAllowedOriginValues();
  await app.register(fastifyCors, {
    origin: allowedOrigins, // <— array of string/RegExp, no function → no TS overload error
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    exposedHeaders: ["Content-Length", "Content-Type"],
    maxAge: 86400,
  });

  /** Multipart (uploads) */
  await app.register(multipart, {
    limits: { fileSize: settings.uploadMaxBytes },
  });

  /** Rate limiting */
  await app.register(rateLimit, {
    max: settings.rateLimit.requests,
    timeWindow: `${settings.rateLimit.windowSeconds}s`,
  });

  /** OpenAPI/Swagger */
  await app.register(swagger, {
    openapi: {
      info: { title: "Diagnostics API", version: settings.version },
      servers: [{ url: "http://localhost:8000" }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
    staticCSP: true,
  });

  /** Diagnostics hooks */
  app.addHook("onRequest", async (request) => {
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
    const durationMs =
      typeof (request as any)._diagnosticStart === "number"
        ? Number((performance.now() - (request as any)._diagnosticStart).toFixed(2))
        : undefined;

    requestStats.total += 1;
    const entry = requestStats.perRoute.get(routeKey) ?? { count: 0, last: 0 };
    entry.count += 1;
    entry.last = Date.now();
    requestStats.perRoute.set(routeKey, entry);

    request.log.info(
      { route: routeKey, statusCode: reply.statusCode, durationMs },
      "request completed",
    );
    done();
  });

  /** Error handler */
  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as any).statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled error");
    }
    const message =
      statusCode >= 500 ? "Internal server error" : (error.message ?? "Request failed");
    reply.status(statusCode).send({ error: message });
  });

  /** Healthcheck */
  app.get(
    "/health",
    {
      schema: { tags: ["ops"], response: { 200: HealthResponseSchema } },
    },
    async () => ({
      status: "ok",
      stub_inference: true,
      uptime_ms: Math.round(process.uptime() * 1000),
    }),
  );

  /** Debug snapshot */
  app.get(
    "/_debug",
    {
      schema: { tags: ["ops"], response: { 200: DebugSnapshotSchema } },
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
        request_counters: { total: requestStats.total, per_route: snapshotRoutes() },
      };
      return snapshot;
    },
  );

  /** API routes */
  await app.register(analyzeImageRoute, { prefix: "/api" });
  await app.register(analyzeJsonRoute, { prefix: "/api" });
  await app.register(machinesRoute, { prefix: "/api" });
  await app.register(exportProfileRoute, { prefix: "/api" });

  /** Not found → JSON */
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: "Not found" });
  });

  /** Ready log */
  app.addHook("onReady", async () => {
    const host = process.env.HOST ?? "0.0.0.0";
    const port = Number(process.env.PORT ?? 8000);
    app.log.info(
      {
        bind: { host, port },
        allowedOrigins: allowedOrigins.map((o) => (o instanceof RegExp ? o.toString() : o)),
      },
      "API is configured; waiting for listen() in server entry",
    );
  });

  return app;
}
