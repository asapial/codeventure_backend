import { Router, type RequestHandler } from "express";
import status from "http-status";
import type { ZodSchema } from "zod";
import AppError from "../../errorHelpers/AppError";
import { validateRequest } from "../../middleware/validateRequest";
import { createAdminHandlers } from "./admin.handlers";
import { requireAdmin, requirePermission, requireStepUp, type AdminPermission } from "./admin.policy";
import type { AdminFeature } from "./admin.service";
import { adminBodySchema, adminIdBodySchema, adminIdSchema, adminListSchema, adminNamedBodySchema } from "./admin.validation";

export type AdminOperation = {
  method: "get" | "post" | "put" | "patch" | "delete"; path: string;
  kind: "list" | "get" | "create" | "update" | "job" | "upsert";
  permission: AdminPermission; action?: string; recordType?: string; job?: string;
  stepUp?: boolean; keyParam?: string;
  providerEnv?: string;
};

export const createAdminFeatureRouter = (feature: AdminFeature, operations: readonly AdminOperation[]) => {
  const router = Router(); const handlers = createAdminHandlers(feature); router.use(requireAdmin);
  for (const op of operations) {
    const middleware: RequestHandler[] = [requirePermission(op.permission)];
    if (op.stepUp) middleware.push(requireStepUp());
    if (op.providerEnv) middleware.push((_req, _res, next) => process.env[op.providerEnv!] ? next() : next(new AppError(status.SERVICE_UNAVAILABLE, "The required provider is not configured.", { code: "PROVIDER_UNAVAILABLE" })));
    let handler: RequestHandler; let schema: ZodSchema = adminBodySchema;
    if (op.kind === "list") { handler = handlers.list; schema = adminListSchema; }
    else if (op.kind === "get") { handler = handlers.get; schema = adminIdSchema; }
    else if (op.kind === "create") handler = handlers.create(op.recordType ?? feature);
    else if (op.kind === "update") { handler = handlers.update(op.action ?? "update", op.job); schema = adminIdBodySchema; }
    else if (op.kind === "upsert") { handler = handlers.upsert(op.recordType ?? feature, op.keyParam); schema = adminNamedBodySchema; }
    else handler = handlers.job(op.job ?? `${feature}.${op.action ?? "run"}`);
    middleware.push(validateRequest(schema), handler);
    router[op.method](op.path, ...middleware);
  }
  return router;
};
