import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const teamOperations = [
  { method: "get", path: "/team", kind: "list", permission: "team.read" },
  { method: "get", path: "/permissions", kind: "list", permission: "team.read" },
  { method: "post", path: "/team/invitations", kind: "create", recordType: "staff-invitation", permission: "team.write" },
  { method: "patch", path: "/team/:id", kind: "update", action: "update-member", permission: "team.write", stepUp: true },
  { method: "put", path: "/roles/:id", kind: "update", action: "update-role", permission: "team.write", stepUp: true },
] as const satisfies readonly AdminOperation[];
export const teamRouter = createAdminFeatureRouter("team", teamOperations);
