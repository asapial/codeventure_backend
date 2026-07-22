import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const projectOperations = [
  { method: "get", path: "/", kind: "list", permission: "projects.read" },
  { method: "post", path: "/", kind: "create", recordType: "project", permission: "projects.write" },
  { method: "patch", path: "/bulk", kind: "job", job: "projects.bulk-update", permission: "projects.write" },
] as const satisfies readonly AdminOperation[];
export const adminProjectsRouter = createAdminFeatureRouter("projects", projectOperations);
