import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const quoteOperations = [
  { method: "get", path: "/", kind: "list", permission: "quotes.read" },
  { method: "post", path: "/", kind: "create", recordType: "quote", permission: "quotes.write" },
  { method: "get", path: "/:id", kind: "get", permission: "quotes.read" },
  { method: "put", path: "/:id", kind: "update", action: "update", permission: "quotes.write" },
  { method: "post", path: "/:id/revisions", kind: "update", action: "create-revision", permission: "quotes.write" },
  { method: "post", path: "/:id/send", kind: "update", action: "send", job: "quote.send", permission: "quotes.write" },
  { method: "post", path: "/:id/convert", kind: "update", action: "convert", permission: "quotes.write", stepUp: true },
] as const satisfies readonly AdminOperation[];
export const quotesRouter = createAdminFeatureRouter("quotes", quoteOperations);
