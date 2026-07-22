import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const contentOperations = [
  { method: "get", path: "/content", kind: "list", permission: "content.read" },
  { method: "post", path: "/content/:type", kind: "create", recordType: "content", permission: "content.publish" },
  { method: "put", path: "/content/:type/:id", kind: "update", action: "update", permission: "content.publish" },
  { method: "post", path: "/content/:type/:id/submit-review", kind: "update", action: "submit-review", permission: "content.publish" },
  { method: "post", path: "/content/:type/:id/publish", kind: "update", action: "publish", job: "content.publish", permission: "content.publish" },
  { method: "get", path: "/content/:type/:id/revisions", kind: "get", permission: "content.read" },
] as const satisfies readonly AdminOperation[];
export const contentRouter = createAdminFeatureRouter("content", contentOperations);
