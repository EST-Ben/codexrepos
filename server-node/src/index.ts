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

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: settings.allowedOrigins,
  });
  await app.register(multipart, {
    limits: { fileSize: settings.uploadMaxBytes },
  });
  await app.register(rateLimit, {
    max: settings.rateLimit.requests,
    timeWindow: `${settings.rateLimit.windowSeconds}s`,
  });

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
    const durationMs = typeof (request as any)._diagnosticStart === "number"
      ? Number((performance.now() - (request as any)._diagnosticStart).toFixed(2))
      : undefined;
    requestStats.total += 1;
    const entry = requestStats.perRoute.get(routeKey) ?? { count: 0, last: 0 };
    entry.count += 1;
    entry.last = Date.now();
    requestStats.perRoute.set(routeKey, entry);
    request.log.info({ route: routeKey, statusCode: reply.statusCode, durationMs }, "request completed");
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled error");
    }
    const message = statusCode >= 500 ? "Internal server error" : error.message ?? "Request failed";
    reply.status(statusCode).send({ error: message });
  });

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

  await app.register(analyzeImageRoute, { prefix: "/api" });
  await app.register(analyzeJsonRoute, { prefix: "/api" });
  await app.register(machinesRoute, { prefix: "/api" });
  await app.register(exportProfileRoute, { prefix: "/api" });

  return app;
}

