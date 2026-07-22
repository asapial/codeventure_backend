import { describe, expect, it } from "vitest";
import { ADMIN_API_OPERATIONS } from "./admin.contract";

describe("admin API contract", () => {
  it("contains every unique A1-A22 operation", () => {
    const keys = ADMIN_API_OPERATIONS.map(([method, path]) => `${method} ${path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("GET /admin/dashboard");
    expect(keys).toContain("POST /admin/system/jobs/:id/retry");
    expect(keys.length).toBeGreaterThanOrEqual(80);
  });
});
