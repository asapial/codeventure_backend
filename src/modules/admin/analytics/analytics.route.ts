import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const analyticsOperations = [
  { method: "get", path: "/analytics", kind: "list", permission: "analytics.read" },
  { method: "post", path: "/analytics/export", kind: "job", job: "analytics.export", permission: "analytics.read" },
] as const satisfies readonly AdminOperation[];
export const analyticsRouter = createAdminFeatureRouter("analytics", analyticsOperations);
