import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const featureFlagOperations = [
  { method: "get", path: "/feature-flags", kind: "list", permission: "feature-flags.read" },
  { method: "post", path: "/feature-flags", kind: "create", recordType: "feature-flag", permission: "feature-flags.write" },
  { method: "put", path: "/feature-flags/:id", kind: "update", action: "rollout", permission: "feature-flags.write" },
] as const satisfies readonly AdminOperation[];
export const featureFlagsRouter = createAdminFeatureRouter("feature-flags", featureFlagOperations);
