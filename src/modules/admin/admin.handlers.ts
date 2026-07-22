import type { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import type { AdminFeature } from "./admin.service";
import { adminService } from "./admin.service";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const context = (req: Request) => ({ actorId: req.user.userId, actorRole: req.user.role, requestId: req.id, idempotencyKey: req.header("idempotency-key") ?? (typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined) });
const ok = (res: Response, payload: unknown, code: number = status.OK) => res.status(code).json(payload);

export const createAdminHandlers = (feature: AdminFeature) => ({
  list: catchAsync(async (req: Request, res: Response) => { const result = await adminService.list(feature, req.query as never); ok(res, { ...result, meta: { ...result.meta, requestId: req.id } }); }),
  get: catchAsync(async (req: Request, res: Response) => ok(res, { data: await adminService.get(feature, first(req.params.id)), requestId: req.id })),
  create: (recordType: string) => catchAsync(async (req: Request, res: Response) => ok(res, await adminService.create(feature, recordType, req.body, context(req)), status.CREATED)),
  update: (action: string, enqueueKind?: string) => catchAsync(async (req: Request, res: Response) => ok(res, await adminService.update(feature, first(req.params.id), action, req.body, context(req), enqueueKind))),
  job: (kind: string) => catchAsync(async (req: Request, res: Response) => ok(res, await adminService.createJob(kind, { ...req.body, ...req.params }, context(req)), status.ACCEPTED)),
  upsert: (recordType: string, keyParam?: string) => catchAsync(async (req: Request, res: Response) => ok(res, await adminService.upsert(feature, recordType, keyParam ? first(req.params[keyParam]) : recordType, req.body, context(req)))),
});
