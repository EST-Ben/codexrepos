import { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { analyzeImage as runPipeline } from "../pipeline.js";
import type { AnalyzeRequestMeta } from "types/api";
import {
  AnalyzeMetaSchema,
  AnalyzeResponseSchema,
  ErrorResponseSchema,
} from "../schemas.js";

export const analyzeImageRoute: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts: unknown,
  done: () => void,
) => {
  app.post(
    "/analyze-image",
    {
      schema: {
        tags: ["analysis"],
        consumes: ["multipart/form-data"],
        response: {
          200: AnalyzeResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parts = req.parts();
      let metaRaw: string | null = null;
      let fileBuffer: Buffer | null = null;
      let filename = "upload.jpg";

    for await (const part of parts) {
      if (part.type === "file") {
        fileBuffer = await part.toBuffer();
        filename = part.filename || filename;
      } else if (part.type === "field" && part.fieldname === "meta") {
        metaRaw = String(part.value ?? "");
      }
    }

    if (!fileBuffer) {
      reply.code(400);
      return { error: "Image part is required." };
    }
    if (!metaRaw) {
      reply.code(400);
      return { error: "Meta field is required." };
    }

    let meta: AnalyzeRequestMeta;
    try {
      meta = AnalyzeMetaSchema.parse(JSON.parse(metaRaw));
    } catch (err) {
      reply.code(400);
      return { error: `Invalid meta payload: ${err instanceof Error ? err.message : String(err)}` };
    }

    try {
      const response = runPipeline(meta, fileBuffer, filename);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Machine '") && message.includes("was not found")) {
        reply.code(404);
        return { error: message };
      }
      app.log.error({ err }, "analyze-image failed");
      reply.code(500);
      return { error: "Failed to process image" };
    }
    },
  );
  done();
};
