export const settings = {
  env: process.env.ENV || "development",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:19006,http://localhost:5173").split(","),
  rateLimit: {
    requests: Number(process.env.RATE_LIMIT_REQUESTS || 30),
    windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
  },
  uploadMaxBytes: (Number(process.env.UPLOAD_MAX_MB || 10)) * 1024 * 1024,
  data: {
    machinesDir: "config/machines",
    taxonomy: "config/taxonomy.json"
  }
};
