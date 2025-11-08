import { createServer } from "./index.js";

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "0.0.0.0";

(async () => {
  try {
    const app = await createServer();
    await app.listen({ port, host });
    const shutdown = async (signal: string) => {
      try {
        await app.close();
      } catch (err) {
        app.log.error({ err, signal }, "error during shutdown");
      } finally {
        process.exit(0);
      }
    };
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => void shutdown(signal));
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
