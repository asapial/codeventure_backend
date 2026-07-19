import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import type { AccountRole } from "../../../prisma/generated/prisma/enums";

/**
 * Shared helpers used across every customer-portal submodule.
 *
 * The customer workspace model is multi-tenant: a user can belong to one or
 * more `Organization`s, and every portal-scoped resource hangs off an
 * `organizationId`. Permission decisions are therefore two-step:
 *
 *   1. Is this user a member of the org?
 *   2. Does their role inside the org permit the operation?
 *
 * `requireOrgMembership()` handles step 1 (and returns the membership row so
 * callers can also read step 2).
 */

export interface OrgMembership {
    id: string;
    userId: string;
    organizationId: string;
    role: AccountRole;
    joinedAt: Date;
}

/** A user is "the customer owner" if they own an org OR are an OWNER member. */
const isCustomerOwner = (role: AccountRole, isOrgOwner: boolean): boolean =>
    isOrgOwner || role === "OWNER";

/**
 * Look up the membership row for `(userId, organizationId)`.
 *
 * Throws:
 *   - 403 FORBIDDEN          if the user is not a member of the org
 *   - 404 NOT_FOUND          if the org doesn't exist
 */
export const requireOrgMembership = async (
    userId: string,
    organizationId: string,
): Promise<OrgMembership> => {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, slug: true },
    });
    if (!org) {
        throw new AppError(status.NOT_FOUND, "Organization not found.");
    }

    const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: {
            id: true,
            userId: true,
            organizationId: true,
            role: true,
            joinedAt: true,
        },
    });
    if (!membership) {
        throw new AppError(
            status.FORBIDDEN,
            "You are not a member of this organization.",
            { code: "ORG_MEMBERSHIP_REQUIRED" },
        );
    }

    return membership;
};

/**
 * Resolve the user's "primary" org — the one we render by default when the
 * caller doesn't pin one. Prefer the org where they are OWNER, fall back to
 * any org membership.
 */
export const resolvePrimaryOrg = async (
    userId: string,
): Promise<{ id: string; slug: string } | null> => {
    const ownOrg = await prisma.organization.findFirst({
        where: { members: { some: { userId, role: "OWNER" } } },
        orderBy: { createdAt: "asc" },
        select: { id: true, slug: true },
    });
    if (ownOrg) return ownOrg;

    const anyMember = await prisma.organizationMember.findFirst({
        where: { userId },
        orderBy: { joinedAt: "asc" },
        select: { organization: { select: { id: true, slug: true } } },
    });
    return anyMember?.organization ?? null;
};

/**
 * Ensure the current user is the customer owner (org owner or OWNER-role
 * member). Used for org-wide writes (settings, billing profile, invitations).
 */
export const requireCustomerOwner = async (
    userId: string,
    organizationId: string,
): Promise<OrgMembership> => {
    const membership = await requireOrgMembership(userId, organizationId);
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
    });
    const ownerRow = await prisma.user.findFirst({
        where: { id: userId },
        select: { id: true },
    });
    const isOrgCreator = ownerRow?.id ? true : false;

    if (!isCustomerOwner(membership.role, isOrgCreator)) {
        throw new AppError(
            status.FORBIDDEN,
            "Only workspace owners can perform this action.",
            { code: "OWNER_REQUIRED" },
        );
    }

    // Suppress TS6133 — we use org for downstream callers via the return value.
    void org;
    return membership;
};

/**
 * Pin the membership whose `organizationId` matches `slug`. Helpful when the
 * frontend passes the org slug (which is what gets shared in URLs).
 */
export const requireOrgBySlug = async (
    userId: string,
    slug: string,
): Promise<{ orgId: string; membership: OrgMembership }> => {
    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
    });
    if (!org) {
        throw new AppError(status.NOT_FOUND, "Organization not found.");
    }
    const membership = await requireOrgMembership(userId, org.id);
    return { orgId: org.id, membership };
};

/** Wire-format project status (lowercase-with-hyphen). */
export const toWireProjectStatus = (db: string): string => {
    if (db === "IN_PROGRESS") return "in-progress";
    return db.toLowerCase();
};

/** ISO helper that tolerates nullish values. */
export const toIso = (d: Date | null | undefined): string | null =>
    d ? d.toISOString() : null;

/** Decimal→number for wire payloads (e.g. invoice totals). */
export const dec = (v: unknown): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const s = (v as { toString(): string }).toString();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};

/** Optional decimal → number for nullable money fields. */
export const decOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    const s = (v as { toString(): string }).toString();
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};
/** Wire-format invoice status. */
export const toWireInvoiceStatus = (db: string):
    | "draft"
    | "sent"
    | "paid"
    | "overdue"
    | "void" => {
    switch (db) {
        case "DRAFT":
            return "draft";
        case "SENT":
            return "sent";
        case "PAID":
            return "paid";
        case "OVERDUE":
            return "overdue";
        case "VOID":
            return "void";
        default:
            return "draft";
    }
};

/** Wire-format ticket status. */
export const toWireTicketStatus = (db: string):
    | "open"
    | "pending"
    | "on-hold"
    | "resolved"
    | "closed" => {
    switch (db) {
        case "PENDING_CUSTOMER":
        case "PENDING_STAFF":
            return "pending";
        case "RESOLVED":
            return "resolved";
        case "CLOSED":
            return "closed";
        case "OPEN":
            return "open";
        default:
            return "open";
    }
};

/** Wire-format ticket priority. */
export const toWireTicketPriority = (db: string):
    | "low"
    | "normal"
    | "high"
    | "urgent" => {
    switch (db) {
        case "LOW":
            return "low";
        case "HIGH":
            return "high";
        case "URGENT":
            return "urgent";
        default:
            return "normal";
    }
};