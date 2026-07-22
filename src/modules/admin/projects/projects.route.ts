import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const projectOperations = [
  { method: "get", path: "/", kind: "list", permission: "projects.read" },
  { method: "post", path: "/", kind: "create", recordType: "project", permission: "projects.write" },
  { method: "patch", path: "/bulk", kind: "job", job: "projects.bulk-update", permission: "projects.write" },
  { method: "post", path: "/:id/milestones", kind: "update", action: "add-milestone", permission: "projects.write" },
  { method: "post", path: "/:id/tasks", kind: "update", action: "add-task", permission: "projects.write" },
  { method: "post", path: "/:id/approvals", kind: "update", action: "request-approval", job: "project.approval", permission: "projects.write" },
  { method: "post", path: "/:id/change-orders", kind: "update", action: "change-order", permission: "projects.write" },
  { method: "patch", path: "/:id/status", kind: "update", action: "status", permission: "projects.write" },
  { method: "put", path: "/:id", kind: "update", action: "update", permission: "projects.write" },
  { method: "get", path: "/:id", kind: "get", permission: "projects.read" },
] as const satisfies readonly AdminOperation[];
export const adminProjectsRouter = createAdminFeatureRouter("projects", projectOperations);
