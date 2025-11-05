import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function resolveVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch (err) {
    console.warn("Failed to read package version", err);
    return "0.0.0";
  }
}

const VERSION = resolveVersion();
const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = resolve(MODULE_DIR, "..", "..", "");

export const settings = {
  env: process.env.ENV || "development",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:19006,http://localhost:5173").split(","),
  rateLimit: {
    requests: Number(process.env.RATE_LIMIT_REQUESTS || 30),
    windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
  },
  uploadMaxBytes: (Number(process.env.UPLOAD_MAX_MB || 10)) * 1024 * 1024,
  version: VERSION,
  rootDir: ROOT_DIR,
  data: {
    machinesDir: resolve(ROOT_DIR, "config", "machines"),
    taxonomy: resolve(ROOT_DIR, "config", "taxonomy.json")
  }
};
