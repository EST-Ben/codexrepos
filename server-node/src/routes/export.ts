import { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";

const SLICER_KEY_MAP: Record<string, Record<string, string>> = {
  cura: {
    nozzle_temp: "material_print_temperature",
    bed_temp: "material_bed_temperature",
    print_speed: "speed_print",
    travel_speed: "speed_travel",
    accel: "acceleration_print",
    jerk: "jerk_print",
    flow_rate: "material_flow",
    fan_speed: "cool_fan_speed",
    retraction_distance: "retraction_amount",
  },
  prusaslicer: {
    nozzle_temp: "temperature",
    bed_temp: "bed_temperature",
    print_speed: "perimeter_speed",
    travel_speed: "travel_speed",
    accel: "perimeter_acceleration",
    jerk: "perimeter_jerk",
    fan_speed: "fan_speed",
    retraction_distance: "retract_length",
  },
  bambu: {
    nozzle_temp: "nozzle_temperature",
    bed_temp: "bed_temperature",
    print_speed: "print_speed",
    travel_speed: "travel_speed",
    accel: "max_acceleration",
    jerk: "max_jerk",
    fan_speed: "cooling_fan_speed",
    flow_rate: "flow_ratio",
    retraction_distance: "retraction_distance",
  },
  orca: {
    nozzle_temp: "nozzle_temperature",
    bed_temp: "build_plate_temperature",
    print_speed: "default_printing_speed",
    travel_speed: "default_travel_speed",
    accel: "default_acceleration",
    jerk: "default_jerk",
    fan_speed: "fan_speed",
    flow_rate: "flow_ratio",
    retraction_distance: "retraction_length",
  },
};

function renderMarkdown(
  slicer: string,
  diff: Record<string, number | string | boolean>,
  baseProfile?: Record<string, number | string | boolean>,
): string {
  const lines = [`# ${slicer[0]?.toUpperCase()}${slicer.slice(1)} profile diff`, ""];
  const keys = Object.keys(diff).sort();
  if (!keys.length) {
    lines.push("No parameter changes were required.");
    return lines.join("\n");
  }
  for (const key of keys) {
    const value = diff[key];
    const baseValue = baseProfile ? baseProfile[key] : undefined;
    if (baseValue === undefined) {
      lines.push(`- **${key}** → ${value}`);
    } else {
      lines.push(`- **${key}**: ${baseValue} → ${value}`);
    }
  }
  return lines.join("\n");
}

export const exportProfileRoute: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts: unknown,
  done: () => void,
) => {
  app.post("/export-profile", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as {
      slicer?: string;
      changes?: Record<string, number | string | boolean>;
      base_profile?: Record<string, number | string | boolean>;
    };
    const slicer = String(body.slicer ?? "").toLowerCase();
    const mapping = SLICER_KEY_MAP[slicer];
    if (!mapping) {
      reply.code(400);
      return { error: `Unsupported slicer '${body.slicer}'` };
    }
    const changes = body.changes ?? {};
    const diff: Record<string, number | string | boolean> = {};
    for (const [key, value] of Object.entries(changes)) {
      const target = mapping[key] ?? key;
      const baseValue = body.base_profile ? body.base_profile[target] : undefined;
      if (baseValue !== value) {
        diff[target] = value;
      }
    }
    const markdown = renderMarkdown(slicer, diff, body.base_profile);
    return { slicer, diff, markdown };
  });
  done();
};
