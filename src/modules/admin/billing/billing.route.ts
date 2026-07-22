import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const billingOperations = [
  { method: "get", path: "/billing", kind: "list", permission: "billing.read" },
  { method: "post", path: "/invoices", kind: "create", recordType: "invoice", permission: "billing.write" },
  { method: "post", path: "/invoices/:id/send", kind: "update", action: "send", job: "invoice.send", permission: "billing.write" },
  { method: "post", path: "/payments/offline", kind: "create", recordType: "offline-payment", permission: "billing.write", stepUp: true },
  { method: "post", path: "/payments/:id/refund", kind: "update", action: "refund", job: "payment.refund", permission: "billing.refund", stepUp: true },
  { method: "post", path: "/billing/reconcile", kind: "job", job: "billing.reconcile", permission: "billing.write" },
] as const satisfies readonly AdminOperation[];
export const billingRouter = createAdminFeatureRouter("billing", billingOperations);
