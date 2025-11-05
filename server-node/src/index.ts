import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import helmet from "helmet";
import fastifySwagger from "fastify-swagger";
import { analyzeImageRoute } from "./routes/analyze-image";
import { analyzeJsonRoute } from "./routes/analyze-json";
import { machinesRoute } from "./routes/machines";
import { exportProfileRoute } from "./routes/export";
import { settings } from "./settings";

export async function createServer() {
  const app = Fastify({ logger: true });

  const helmetMiddleware = helmet();
  app.addHook("onRequest", (req, reply, done) => {
    helmetMiddleware(req.raw, reply.raw, done);
  });

  await app.register(cors, {
    origin: settings.allowedOrigins,
  });
  await app.register(multipart, { limits: { fileSize: settings.uploadMaxBytes } });
  await app.register(rateLimit, {
    max: settings.rateLimit.requests,
    timeWindow: `${settings.rateLimit.windowSeconds}s`,
  });

  await app.register(fastifySwagger, {
    mode: "dynamic",
    routePrefix: "/docs",
    openapi: {
      info: { title: "Diagnostics API", version: "1.0.0" },
    },
    exposeRoute: true,
  });

  app.addHook("onRequest", (req, _reply, done) => {
    const cl = Number(req.headers["content-length"] || 0);
    if (cl && cl > settings.uploadMaxBytes) return done(new Error("Payload too large"));
    done();
  });

  app.get("/health", async () => ({ status: "ok", stub_inference: true }));

  await app.register(analyzeImageRoute, { prefix: "/api" });
  await app.register(analyzeJsonRoute, { prefix: "/api" });
  await app.register(machinesRoute, { prefix: "/api" });
  await app.register(exportProfileRoute, { prefix: "/api" });

  return app;
}

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "0.0.0.0";

if (process.env.NODE_ENV !== "test") {
  createServer()
    .then((app) => app.listen({ port, host }))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
