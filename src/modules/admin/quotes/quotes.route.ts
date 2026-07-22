import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const quoteOperations = [
  { method: "get", path: "/", kind: "list", permission: "quotes.read" },
  { method: "post", path: "/", kind: "create", recordType: "quote", permission: "quotes.write" },
] as const satisfies readonly AdminOperation[];
export const quotesRouter = createAdminFeatureRouter("quotes", quoteOperations);
