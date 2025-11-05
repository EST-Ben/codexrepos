import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "../src/index.js";
import { settings } from "../src/settings.js";

let api: Awaited<ReturnType<typeof createServer>>;

function readFirstMachineId(): string {
  const machinesDir = settings.data.machinesDir;
  const files = fs
    .readdirSync(machinesDir)
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"));
  if (!files.length) {
    throw new Error("No machine profiles found under config/machines");
  }
  const data = JSON.parse(fs.readFileSync(path.join(machinesDir, files[0]), "utf-8")) as { id?: string };
  return data.id ?? path.basename(files[0], ".json");
}

beforeAll(async () => {
  api = await createServer();
  await api.ready();
});

afterAll(async () => {
  await api.close();
});

describe("API surface", () => {
  it("exposes health information", async () => {
    const res = await request(api.server).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("uptime_ms");
  });

  it("exposes debug snapshot", async () => {
    const res = await request(api.server).get("/_debug").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("version");
    expect(res.body.request_counters.total).toBeGreaterThan(0);
  });

  it("lists machines", async () => {
    const res = await request(api.server).get("/api/machines").expect(200);
    expect(Array.isArray(res.body.machines)).toBe(true);
    expect(res.body.machines.length).toBeGreaterThan(0);
  });

  it("analyzes JSON payloads", async () => {
    const machineId = readFirstMachineId();
    const res = await request(api.server)
      .post("/api/analyze-json")
      .send({
        machine: machineId,
        experience: "Intermediate",
        material: "PLA",
        payload: { base_profile: { speed_print: 120 } },
      })
      .expect(200);

    expect(res.body).toHaveProperty("image_id");
    expect(res.body.machine?.id).toBeDefined();
  });

  it("analyzes image uploads", async () => {
    const machineId = readFirstMachineId();
    const res = await request(api.server)
      .post("/api/analyze-image")
      .attach("image", Buffer.from("stub"), "sample.png")
      .field(
        "meta",
        JSON.stringify({
          machine_id: machineId,
          experience: "Intermediate",
          material: "PLA",
        }),
      )
      .expect(200);

    expect(res.body).toHaveProperty("image_id");
    expect(res.body.machine?.id).toBeDefined();
  });

  it("exports profile diffs", async () => {
    const res = await request(api.server)
      .post("/api/export-profile")
      .send({
        slicer: "cura",
        changes: { nozzle_temp: 215 },
        base_profile: { material_print_temperature: 210 },
      })
      .expect(200);

    expect(res.body.slicer).toBe("cura");
    expect(res.body.diff).toHaveProperty("material_print_temperature", 215);
  });
});
