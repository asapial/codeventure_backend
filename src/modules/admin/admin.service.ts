import status from "http-status";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { hashAdminValue, recordAudit } from "./admin.policy";

export const ADMIN_FEATURES = ["dashboard", "leads", "quotes", "customers", "projects", "catalog", "billing", "team", "content", "analytics", "settings", "integrations", "notifications", "feature-flags", "security", "audit-log", "backups", "system-jobs"] as const;
export type AdminFeature = (typeof ADMIN_FEATURES)[number];
/** Fixture mode was intentionally removed; retained only for source compatibility. */
export const isFixtureModeEnabled = () => false;

export interface AdminListQuery { q?: string; status?: string; page?: number; pageSize?: number; organizationId?: string; }
export interface AdminMutationContext { actorId: string; actorRole: string; requestId: string; idempotencyKey?: string; }

const serialize = (row: { createdAt: Date; updatedAt: Date; [key: string]: unknown }) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

const list = async (feature: AdminFeature, query: AdminListQuery = {}) => {
  const page = query.page ?? 1; const pageSize = query.pageSize ?? 25;
  const where: Prisma.AdminRecordWhereInput = { feature, archivedAt: null,
    ...(query.status ? { status: query.status } : {}), ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.adminRecord.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.adminRecord.count({ where }),
  ]);
  return { data: rows.map(serialize), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
};

const get = async (feature: AdminFeature, id: string) => {
  const row = await prisma.adminRecord.findFirst({ where: { id, feature, archivedAt: null } });
  if (!row) throw new AppError(status.NOT_FOUND, "Record not found.", { code: "NOT_FOUND" });
  return serialize(row);
};

const withIdempotency = async <T>(scope: string, ctx: AdminMutationContext, body: unknown, execute: () => Promise<T>): Promise<T> => {
  if (!ctx.idempotencyKey) return execute();
  const keyHash = hashAdminValue(ctx.idempotencyKey); const requestHash = hashAdminValue(JSON.stringify(body));
  const cached = await prisma.adminIdempotencyKey.findUnique({ where: { actorId_scope_keyHash: { actorId: ctx.actorId, scope, keyHash } } });
  if (cached) {
    if (cached.requestHash !== requestHash) throw new AppError(status.CONFLICT, "Idempotency key was already used with a different request.", { code: "IDEMPOTENCY_CONFLICT" });
    return cached.response as T;
  }
  const result = await execute();
  await prisma.adminIdempotencyKey.create({ data: { actorId: ctx.actorId, scope, keyHash, requestHash, statusCode: 200, response: result as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
  return result;
};

const create = async (feature: AdminFeature, recordType: string, body: Record<string, unknown>, ctx: AdminMutationContext) =>
  withIdempotency(`${feature}.create`, ctx, body, () => prisma.$transaction(async tx => {
    const row = await tx.adminRecord.create({ data: { feature, recordType, title: String(body.title ?? body.name ?? `New ${recordType}`), status: String(body.status ?? "DRAFT"), organizationId: typeof body.organizationId === "string" ? body.organizationId : null, data: body as Prisma.InputJsonValue, createdById: ctx.actorId, updatedById: ctx.actorId } });
    const audit = await recordAudit({ actorId: ctx.actorId, actorRole: ctx.actorRole, action: `${feature}.create`, target: { kind: recordType, id: row.id }, organizationId: row.organizationId, after: row, requestId: ctx.requestId }, tx);
    return { data: serialize(row), auditRef: audit.id, requestId: ctx.requestId };
  }));

const update = async (feature: AdminFeature, id: string, action: string, body: Record<string, unknown>, ctx: AdminMutationContext, enqueueKind?: string) =>
  withIdempotency(`${feature}.${action}.${id}`, ctx, body, () => prisma.$transaction(async tx => {
    const current = await tx.adminRecord.findFirst({ where: { id, feature, archivedAt: null } });
    if (!current) throw new AppError(status.NOT_FOUND, "Record not found.", { code: "NOT_FOUND" });
    const version = Number(body.version ?? current.version);
    if (version !== current.version) throw new AppError(status.CONFLICT, "This record changed in another session. Reload before retrying.", { code: "STALE_VERSION" });
    const nextData = { ...(current.data as Record<string, unknown>), ...body, lastAction: action };
    const updated = await tx.adminRecord.update({ where: { id }, data: { title: typeof body.title === "string" ? body.title : current.title, status: typeof body.status === "string" ? body.status : current.status, data: nextData as Prisma.InputJsonValue, version: { increment: 1 }, updatedById: ctx.actorId } });
    const job = enqueueKind ? await tx.adminOutboxJob.create({ data: { kind: enqueueKind, payload: { feature, id, action } as Prisma.InputJsonValue, requestedById: ctx.actorId, idempotencyKey: ctx.idempotencyKey ?? `${ctx.requestId}:${action}` } }) : null;
    const audit = await recordAudit({ actorId: ctx.actorId, actorRole: ctx.actorRole, action: `${feature}.${action}`, target: { kind: current.recordType, id }, organizationId: current.organizationId, before: current, after: updated, requestId: ctx.requestId }, tx);
    return { data: serialize(updated), auditRef: audit.id, ...(job ? { jobRef: job.id } : {}), requestId: ctx.requestId };
  }));

const createJob = async (kind: string, payload: Record<string, unknown>, ctx: AdminMutationContext) => withIdempotency(kind, ctx, payload, async () => {
  const job = await prisma.adminOutboxJob.create({ data: { kind, payload: payload as Prisma.InputJsonValue, requestedById: ctx.actorId, idempotencyKey: ctx.idempotencyKey ?? ctx.requestId } });
  return { data: job, jobRef: job.id, requestId: ctx.requestId };
});

export const adminService = { list, get, create, update, createJob };
export { prisma };
