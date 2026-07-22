import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const securityOperations = [
  { method: "get", path: "/security", kind: "list", permission: "security.read" },
  { method: "get", path: "/security/alerts", kind: "list", permission: "security.read" },
  { method: "patch", path: "/security/alerts/:id", kind: "update", action: "acknowledge-alert", permission: "security.write" },
  { method: "get", path: "/security/sessions", kind: "list", permission: "security.read" },
  { method: "post", path: "/security/revoke-sessions", kind: "job", job: "security.revoke-sessions", permission: "security.write", stepUp: true },
  { method: "get", path: "/security/api-keys", kind: "list", permission: "security.read" },
  { method: "post", path: "/security/api-keys", kind: "create", recordType: "api-key", permission: "security.write", stepUp: true },
  { method: "delete", path: "/security/api-keys/:id", kind: "update", action: "revoke-api-key", permission: "security.write", stepUp: true },
  { method: "put", path: "/security/rate-limits", kind: "upsert", recordType: "rate-limits", permission: "security.write", stepUp: true },
] as const satisfies readonly AdminOperation[];
export const securityRouter = createAdminFeatureRouter("security", securityOperations);
