import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const settingsOperations = [
  { method: "get", path: "/settings", kind: "list", permission: "settings.read" },
  { method: "put", path: "/settings", kind: "upsert", recordType: "platform-settings", permission: "settings.write", stepUp: true },
] as const satisfies readonly AdminOperation[];
export const settingsRouter = createAdminFeatureRouter("settings", settingsOperations);
