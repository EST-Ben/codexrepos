import { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { analyzeJson as runJsonPipeline } from "../pipeline.js";
import type { AnalyzeRequestMeta } from "types/api";
import {
  AnalyzeJsonRequestSchema,
  AnalyzeResponseSchema,
  ErrorResponseSchema,
} from "../schemas.js";

export const analyzeJsonRoute: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts: unknown,
  done: () => void,
) => {
  app.post(
    "/analyze-json",
    {
      schema: {
        tags: ["analysis"],
        response: {
          200: AnalyzeResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      let payload;
      try {
        payload = AnalyzeJsonRequestSchema.parse(req.body ?? {});
      } catch (err) {
        reply.code(400);
        return { error: `Invalid request: ${err instanceof Error ? err.message : String(err)}` };
      }

      const baseProfileRaw = payload.payload?.base_profile;
      const baseProfile: Record<string, number> | undefined =
        baseProfileRaw && typeof baseProfileRaw === "object"
          ? Object.fromEntries(
              Object.entries(baseProfileRaw as Record<string, unknown>)
                .filter(([, value]) => typeof value === "number")
                .map(([key, value]) => [key, value as number]),
            )
          : undefined;

      const meta: AnalyzeRequestMeta = {
        machine_id: payload.machine,
        experience: payload.experience,
        material: payload.material,
        base_profile: baseProfile,
      };

      try {
        const response = runJsonPipeline(meta, { issues: payload.issues ?? [], data: payload.payload ?? {} });
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Machine '") && message.includes("was not found")) {
          reply.code(404);
          return { error: message };
        }
        app.log.error({ err }, "analyze-json failed");
        reply.code(500);
        return { error: "Failed to analyze payload" };
      }
    },
  );
  done();
};
