import { ExportProfileResponse } from "../types";

test("export profile contract shape", () => {
  const sample: ExportProfileResponse = { profile: { name: "X", params: {} }, warnings: [] };
  expect(sample.profile).toHaveProperty("params");
});
