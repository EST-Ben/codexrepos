import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { machineSummaries } from "../machines/registry";

export const machinesRoute: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  app.get("/machines", async () => {
    const payload = machineSummaries();
    return { machines: payload };
  });
  done();
};
