import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADMIN_API_OPERATIONS } from "./admin.contract";
import { createAdminOpenApiDocument } from "./admin.openapi";

describe("admin API contract", () => {
  it("contains every unique A1-A22 operation", () => {
    const keys = ADMIN_API_OPERATIONS.map(([method, path]) => `${method} ${path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("GET /admin/dashboard");
    expect(keys).toContain("POST /admin/system/jobs/:id/retry");
    expect(keys.length).toBeGreaterThanOrEqual(80);
  });

  it("generates an OpenAPI operation for every manifest entry", () => {
    const document = createAdminOpenApiDocument();
    const operationCount = Object.values(document.paths).reduce((total, path) => total + Object.keys(path).length, 0);
    expect(operationCount).toBe(ADMIN_API_OPERATIONS.length);
    expect(document.paths["/api/v1/admin/customers/{id}/status"]).toHaveProperty("patch");
  });

  it("keeps the committed OpenAPI artifact in sync", () => {
    const artifact = readFileSync(resolve(process.cwd(), "openapi", "admin.openapi.json"), "utf8");
    expect(artifact).toBe(`${JSON.stringify(createAdminOpenApiDocument(), null, 2)}\n`);
  });
});
