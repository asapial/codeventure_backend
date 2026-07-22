import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const customerOperations = [
  { method: "get", path: "/", kind: "list", permission: "customers.read" },
  { method: "post", path: "/", kind: "create", recordType: "customer", permission: "customers.write" },
  { method: "post", path: "/:id/invitations", kind: "update", action: "invite", job: "customer.invitation", permission: "customers.write" },
  { method: "post", path: "/:id/impersonation", kind: "update", action: "impersonate", permission: "customers.write", stepUp: true },
  { method: "patch", path: "/:id/status", kind: "update", action: "status", permission: "customers.write" },
  { method: "get", path: "/:id", kind: "get", permission: "customers.read" },
] as const satisfies readonly AdminOperation[];
export const customersRouter = createAdminFeatureRouter("customers", customerOperations);
