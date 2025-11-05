import { z } from "zod";
import type {
  AnalyzeRequestMeta,
  AnalyzeResponse,
  DebugSnapshot,
  ExportProfileResponse,
  HealthResponse,
  MachinesResponse,
  Suggestion,
} from "types/api";

export const ExperienceLevelSchema = z.enum(["Beginner", "Intermediate", "Advanced"]);

export const AnalyzeMetaSchema: z.ZodType<AnalyzeRequestMeta> = z.object({
  machine_id: z.string().min(1),
  experience: ExperienceLevelSchema.default("Intermediate"),
  material: z.string().optional(),
  base_profile: z.record(z.string(), z.number()).optional(),
  app_version: z.string().optional(),
});

const BoundingBoxSchema = z.object({
  issue_id: z.string(),
  confidence: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const HeatmapSchema = z
  .object({
    encoding: z.literal("svg"),
    width: z.number(),
    height: z.number(),
    data_url: z.string(),
  })
  .nullable()
  .optional();

const SuggestionChangeSchema = z.object({
  param: z.string(),
  delta: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  new_target: z.number().nullable().optional(),
  range_hint: z
    .tuple([z.number(), z.number()])
    .nullable()
    .optional(),
});

export const SuggestionSchema: z.ZodType<Suggestion> = z.object({
  issue_id: z.string(),
  changes: z.array(SuggestionChangeSchema),
  why: z.string(),
  risk: z.string(),
  confidence: z.number(),
  beginner_note: z.string().nullable().optional(),
  advanced_note: z.string().nullable().optional(),
  clamped_to_machine_limits: z.boolean().nullable().optional(),
});

const SlicerProfileParameterSchema = z.object({
  value: z.number().optional(),
  delta: z.number().optional(),
  unit: z.string().optional(),
  range_hint: z.tuple([z.number(), z.number()]).optional(),
  clamped: z.boolean().optional(),
});

const SlicerProfileDiffSchema = z
  .object({
    diff: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    parameters: z.record(z.string(), SlicerProfileParameterSchema).optional(),
    markdown: z.string().optional(),
  })
  .optional();

const AppliedClampSchema = z.object({
  parameters: z.record(z.string(), z.number()),
  hidden_parameters: z.array(z.string()),
  experience_level: ExperienceLevelSchema,
  clamped_to_machine_limits: z.boolean(),
  explanations: z.array(z.string()),
});

export const AnalyzeResponseSchema: z.ZodType<AnalyzeResponse> = z.object({
  image_id: z.string(),
  version: z.string(),
  machine: z.object({
    id: z.string(),
    brand: z.string(),
    model: z.string(),
  }),
  experience: ExperienceLevelSchema,
  material: z.string().optional(),
  predictions: z.array(z.object({ issue_id: z.string(), confidence: z.number() })),
  explanations: z.array(z.string()),
  localization: z.object({
    boxes: z.array(BoundingBoxSchema),
    heatmap: HeatmapSchema,
  }),
  capability_notes: z.array(z.string()),
  recommendations: z.array(z.string()),
  suggestions: z.array(SuggestionSchema),
  slicer_profile_diff: SlicerProfileDiffSchema,
  applied: AppliedClampSchema,
  low_confidence: z.boolean(),
  parameter_targets: z.record(z.string(), z.number()),
  issues: z.array(z.object({ id: z.string(), confidence: z.number() })).optional(),
  issue_list: z.array(z.object({ id: z.string(), confidence: z.number() })).optional(),
  clamp_explanations: z.array(z.string()).optional(),
});

const MachineSummarySchema = z
  .object({
    id: z.string(),
    brand: z.string(),
    model: z.string(),
    type: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    capabilities: z.array(z.string()).optional(),
    safe_speed_ranges: z
      .object({
        print: z.tuple([z.number(), z.number()]).optional(),
        travel: z.tuple([z.number(), z.number()]).optional(),
        accel: z.tuple([z.number(), z.number()]).optional(),
        jerk: z.tuple([z.number(), z.number()]).optional(),
      })
      .optional(),
    max_nozzle_temp_c: z.number().optional(),
    max_bed_temp_c: z.number().optional(),
    spindle_rpm_range: z.tuple([z.number(), z.number()]).optional(),
    max_feed_mm_min: z.number().optional(),
    material_presets: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export const MachinesResponseSchema: z.ZodType<MachinesResponse> = z.object({
  machines: z.array(MachineSummarySchema),
});

export const ExportProfileRequestSchema = z.object({
  slicer: z.string().min(1),
  changes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  base_profile: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export const ExportProfileResponseSchema: z.ZodType<ExportProfileResponse> = z.object({
  slicer: z.string(),
  diff: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  markdown: z.string().optional(),
});

export const AnalyzeJsonRequestSchema = z.object({
  machine: z.string().min(1),
  material: z.string().optional(),
  issues: z.array(z.string()).optional(),
  experience: ExperienceLevelSchema,
  payload: z.record(z.string(), z.any()).optional(),
});

export const HealthResponseSchema: z.ZodType<HealthResponse> = z.object({
  status: z.literal("ok"),
  stub_inference: z.boolean(),
  uptime_ms: z.number(),
});

export const DebugSnapshotSchema: z.ZodType<DebugSnapshot> = z.object({
  status: z.literal("ok"),
  env: z.string(),
  version: z.string(),
  timestamp: z.string(),
  uptime_ms: z.number(),
  rate_limit: z.object({
    requests: z.number(),
    windowSeconds: z.number(),
  }),
  upload_max_mb: z.number(),
  memory: z.object({
    rss: z.number(),
    heapUsed: z.number(),
    heapTotal: z.number(),
    external: z.number(),
  }),
  request_counters: z.object({
    total: z.number(),
    per_route: z.record(
      z.string(),
      z.object({
        count: z.number(),
        last_request_ts: z.string().nullable(),
      }),
    ),
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

