import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const catalogOperations = [
  { method: "get", path: "/catalog", kind: "list", permission: "catalog.read" },
  { method: "post", path: "/services", kind: "create", recordType: "service", permission: "catalog.write" },
  { method: "put", path: "/services/:id", kind: "update", action: "update-service", permission: "catalog.write" },
  { method: "post", path: "/packages", kind: "create", recordType: "package", permission: "catalog.write" },
  { method: "put", path: "/maintenance-plans/:id", kind: "update", action: "update-maintenance-plan", permission: "catalog.write" },
] as const satisfies readonly AdminOperation[];
export const catalogRouter = createAdminFeatureRouter("catalog", catalogOperations);
