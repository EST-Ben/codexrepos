import { ExportProfileResponse } from "../types";

test("export profile contract shape", () => {
  const sample: ExportProfileResponse = { slicer: "cura", diff: { speed_print: 120 }, markdown: "- **speed_print**" };
  expect(sample.diff).toHaveProperty("speed_print");
});
