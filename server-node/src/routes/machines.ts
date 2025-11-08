import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { machineSummaries } from "../machines/registry.js";
import { MachinesResponseSchema } from "../schemas.js";

export const machinesRoute: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  app.get(
    "/machines",
    {
      schema: {
        tags: ["machines"],
        response: {
          200: MachinesResponseSchema,
        },
      },
    },
    async () => {
      const payload = machineSummaries();
      return { machines: payload };
    },
  );
  done();
};
