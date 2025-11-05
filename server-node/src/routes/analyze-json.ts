import { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { analyzeJson as runJsonPipeline } from "../pipeline";
import type { AnalyzeRequestMeta } from "types/api";

const BodySchema = z.object({
  machine: z.string().min(1),
  material: z.string().optional(),
  issues: z.array(z.string()).optional(),
  experience: z.enum(["Beginner", "Intermediate", "Advanced"]).default("Intermediate"),
  payload: z.record(z.any()).optional(),
});

export const analyzeJsonRoute: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts: unknown,
  done: () => void,
) => {
  app.post("/analyze-json", async (req: FastifyRequest, reply: FastifyReply) => {
    let payload;
    try {
      payload = BodySchema.parse(req.body ?? {});
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
  });
  done();
};
