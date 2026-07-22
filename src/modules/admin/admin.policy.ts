import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { Role } from "../../../prisma/generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { checkAuth } from "../../middleware/checkAuth";
import { prisma } from "../../lib/prisma";

export const ADMIN_PERMISSIONS = [
  "dashboard.read", "leads.read", "leads.write", "quotes.read", "quotes.write",
  "customers.read", "customers.write", "projects.read", "projects.write",
  "catalog.read", "catalog.write", "billing.read", "billing.write", "billing.refund",
  "team.read", "team.write", "content.read", "content.publish", "analytics.read",
  "settings.read", "settings.write", "integrations.read", "integrations.write",
  "notifications.read", "notifications.write", "feature-flags.read", "feature-flags.write",
  "security.read", "security.write", "audit.read", "backups.read", "backups.write",
  "system-jobs.read", "system-jobs.write",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const authenticateAdmin = checkAuth(Role.ADMIN);

/** ADMIN access requires an active account and enrolled 2FA. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  authenticateAdmin(req, res, async (error?: unknown) => {
    if (error) return next(error);
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { twoFactorEnabled: true },
      });
      if (!user?.twoFactorEnabled) {
        throw new AppError(status.FORBIDDEN, "Two-factor authentication is required for the admin console.", { code: "TWO_FACTOR_REQUIRED" });
      }
      return next();
    } catch (cause) {
      return next(cause);
    }
  });
};

export const requirePermission = (permission: AdminPermission) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user.role !== Role.ADMIN) throw new AppError(status.FORBIDDEN, "Permission denied.", { code: "FORBIDDEN" });
      const explicit = await prisma.adminPermissionGrant.count({ where: { userId: req.user.userId } });
      if (explicit > 0) {
        const granted = await prisma.adminPermissionGrant.findUnique({
          where: { userId_permission: { userId: req.user.userId, permission } },
          select: { id: true },
        });
        if (!granted) throw new AppError(status.FORBIDDEN, "Permission denied.", { code: "FORBIDDEN" });
      }
      next();
    } catch (cause) { next(cause); }
  };

export const STEP_UP_WINDOW_MIN = Number(process.env.ADMIN_STEP_UP_WINDOW_MIN ?? 15);
export const requireStepUp = () => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const recent = await prisma.session.findFirst({
      where: { userId: req.user.userId, expiresAt: { gt: new Date() }, stepUpVerifiedAt: { gte: new Date(Date.now() - STEP_UP_WINDOW_MIN * 60_000) } },
      orderBy: { stepUpVerifiedAt: "desc" }, select: { id: true },
    });
    if (!recent) throw new AppError(status.FORBIDDEN, "Re-authenticate to perform this action.", { code: "STEP_UP_REQUIRED" });
    next();
  } catch (cause) { next(cause); }
};

const SECRET_KEYS = /password|secret|token|otp|authorization|cookie|api[-_]?key|signed[-_]?url/i;
export const redactAdminValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactAdminValue);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, SECRET_KEYS.test(key) ? "[REDACTED]" : redactAdminValue(item)]),
  );
  return value;
};

export type AdminTransaction = Prisma.TransactionClient;
export interface AdminAuditInput {
  actorId?: string | null; actorRole?: string | null; action: string;
  target: { kind: string; id: string }; organizationId?: string | null;
  before?: unknown; after?: unknown; requestId?: string; outcome?: "SUCCEEDED" | "FAILED" | "DENIED";
  metadata?: unknown;
}

/** Successful mutations pass their transaction so audit failure rolls back the domain write. */
export const recordAudit = async (input: AdminAuditInput, tx: AdminTransaction | typeof prisma = prisma) =>
  tx.adminAuditLog.create({ data: {
    actorId: input.actorId ?? null, actorRole: input.actorRole ?? null,
    action: input.action, targetType: input.target.kind, targetId: input.target.id,
    organizationId: input.organizationId ?? null, requestId: input.requestId ?? "system",
    outcome: input.outcome ?? "SUCCEEDED",
    beforeJson: redactAdminValue(input.before ?? null) as Prisma.InputJsonValue,
    afterJson: redactAdminValue(input.after ?? null) as Prisma.InputJsonValue,
    metadata: redactAdminValue(input.metadata ?? null) as Prisma.InputJsonValue,
  }, select: { id: true } });

export const hashAdminValue = (value: string) => createHash("sha256").update(value).digest("hex");

/** Compatibility shim for pre-foundation tests; production auditing never buffers. */
export const drainInMemoryAudit = (): AdminAuditInput[] => [];
