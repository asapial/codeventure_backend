import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const integrationOperations = [
  { method: "get", path: "/integrations", kind: "list", permission: "integrations.read" },
  { method: "put", path: "/integrations/:key", kind: "upsert", keyParam: "key", recordType: "integration", permission: "integrations.write", stepUp: true },
  { method: "post", path: "/integrations/:key/test", kind: "job", job: "integration.test", permission: "integrations.write" },
  { method: "post", path: "/webhooks/:id/replay", kind: "job", job: "webhook.replay", permission: "integrations.write", stepUp: true },
] as const satisfies readonly AdminOperation[];
export const integrationsRouter = createAdminFeatureRouter("integrations", integrationOperations);
