/**
 * Shared helpers for the staff-side Customer Support Console.
 *
 * Mounted under `/api/v1/support`. Distinct from the customer-facing
 * `/customer` portal — this surface is staff-only and the support
 * console is gated to ADMIN + TEACHER system roles.
 *
 * The wire shape intentionally mirrors `portal.policy.ts` so the
 * frontend can re-use the same `TicketStatusWire`, `TicketPriorityWire`
 * helpers without forking logic.
 */

import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role } from "../../../prisma/generated/prisma/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Authorisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles allowed into the staff support console. STUDENT is excluded — the
 * console is for human agents only.
 */
export const SUPPORT_AGENT_ROLES: readonly Role[] = [Role.ADMIN, Role.TEACHER] as const;

/**
 * Confirm the current user is allowed inside the support console.
 * Throws 403 if the caller's system role isn't `ADMIN` or `TEACHER`.
 */
export const requireSupportAgent = async (
    userId: string,
): Promise<{ id: string; role: Role; name: string | null; email: string }> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, email: true, isDeleted: true, isActive: true },
    });
    if (!user || user.isDeleted || !user.isActive) {
        throw new AppError(status.FORBIDDEN, "Support console access denied.");
    }
    if (!SUPPORT_AGENT_ROLES.includes(user.role)) {
        throw new AppError(
            status.FORBIDDEN,
            "Only admins and teachers can access the support console.",
            { code: "SUPPORT_AGENT_REQUIRED" },
        );
    }
    return { id: user.id, role: user.role, name: user.name, email: user.email };
};

/**
 * Look up a ticket by id and confirm it exists.
 * Returns the ticket row + its organization id so callers can scope further
 * permission checks.
 */
export const requireTicketAccess = async (ticketId: string): Promise<{
    id: string;
    ticketNumber: string;
    organizationId: string;
    status: string;
}> => {
    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, ticketNumber: true, organizationId: true, status: true },
    });
    if (!ticket) {
        throw new AppError(status.NOT_FOUND, "Ticket not found.");
    }
    return ticket;
};

// ─────────────────────────────────────────────────────────────────────────────
// Wire-format mappers (DB enum → camelCase / kebab-case)
// ─────────────────────────────────────────────────────────────────────────────

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
        case "ON_HOLD":
            return "on-hold";
        case "OPEN":
        default:
            return "open";
    }
};

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

export const toWireAccountStatus = (db: string):
    | "active"
    | "at-risk"
    | "churning"
    | "dormant"
    | "closed" => {
    switch (db) {
        case "AT_RISK":
            return "at-risk";
        case "CHURNING":
            return "churning";
        case "DORMANT":
            return "dormant";
        case "CLOSED":
            return "closed";
        case "ACTIVE":
        default:
            return "active";
    }
};

export const toWireSentiment = (db: string | null | undefined):
    | "positive"
    | "neutral"
    | "negative"
    | "at-risk"
    | null => {
    if (!db) return null;
    switch (db) {
        case "POSITIVE":
            return "positive";
        case "NEGATIVE":
            return "negative";
        case "AT_RISK":
            return "at-risk";
        case "NEUTRAL":
        default:
            return "neutral";
    }
};

export const toWireSlaSeverity = (db: string):
    | "low"
    | "normal"
    | "high"
    | "critical" => {
    switch (db) {
        case "LOW":
            return "low";
        case "HIGH":
            return "high";
        case "CRITICAL":
            return "critical";
        default:
            return "normal";
    }
};

export const toWireResolutionCode = (db: string):
    | "fixed"
    | "workaround"
    | "duplicate"
    | "wont-fix"
    | "customer-responded"
    | "escalated-to-engineering"
    | "billing-adjustment"
    | "other" => {
    switch (db) {
        case "FIXED":
            return "fixed";
        case "WORKAROUND":
            return "workaround";
        case "DUPLICATE":
            return "duplicate";
        case "WONT_FIX":
            return "wont-fix";
        case "CUSTOMER_RESPONDED":
            return "customer-responded";
        case "ESCALATED_TO_ENGINEERING":
            return "escalated-to-engineering";
        case "BILLING_ADJUSTMENT":
            return "billing-adjustment";
        default:
            return "other";
    }
};

export const toWireHelpArticleStatus = (db: string):
    | "draft"
    | "in-review"
    | "published"
    | "archived" => {
    switch (db) {
        case "IN_REVIEW":
            return "in-review";
        case "PUBLISHED":
            return "published";
        case "ARCHIVED":
            return "archived";
        case "DRAFT":
        default:
            return "draft";
    }
};

export const toWireNoteVisibility = (db: string):
    | "internal-team"
    | "leadership"
    | "private" => {
    switch (db) {
        case "LEADERSHIP":
            return "leadership";
        case "PRIVATE":
            return "private";
        case "INTERNAL_TEAM":
        default:
            return "internal-team";
    }
};

export const toWireJobRunStatus = (db: string):
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "partial" => {
    switch (db) {
        case "RUNNING":
            return "running";
        case "SUCCEEDED":
            return "succeeded";
        case "FAILED":
            return "failed";
        case "PARTIAL":
            return "partial";
        case "QUEUED":
        default:
            return "queued";
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Date / number helpers
// ─────────────────────────────────────────────────────────────────────────────

export const toIso = (d: Date | null | undefined): string | null =>
    d ? d.toISOString() : null;

/** Whole minutes between two dates, floored. Returns null if `from` missing. */
export const diffMinutes = (from: Date | null | undefined, to: Date = new Date()): number | null => {
    if (!from) return null;
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
};

/** Whole hours between two dates, floored. */
export const diffHours = (from: Date | null | undefined, to: Date = new Date()): number | null => {
    const m = diffMinutes(from, to);
    return m === null ? null : Math.floor(m / 60);
};

/** Whole days between two dates, floored. */
export const diffDays = (from: Date | null | undefined, to: Date = new Date()): number | null => {
    const m = diffMinutes(from, to);
    return m === null ? null : Math.floor(m / (60 * 24));
};

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

// ─────────────────────────────────────────────────────────────────────────────
// SLA computation
// ─────────────────────────────────────────────────────────────────────────────

export interface SlaPolicyShape {
    firstResponseMinutes: number;
    resolutionMinutes: number;
    businessHoursTz?: string | null;
}

export interface SlaClock {
    /** "on-track" | "warning" | "breached" — used by chips & inbox filters. */
    firstResponseState: "satisfied" | "on-track" | "warning" | "breached";
    resolutionState: "satisfied" | "on-track" | "warning" | "breached";
    minutesSinceOpen: number | null;
    minutesToFirstResponseDue: number | null;
    minutesToResolutionDue: number | null;
    minutesSinceFirstResponse: number | null;
    percentElapsedFirst: number | null;
    percentElapsedResolution: number | null;
}

/**
 * Given the policy for a ticket and its current state, compute the SLA clock
 * state. Pure function — no DB I/O — so unit-testable from support.utils.test.
 *
 * "warning" is 80% of the budget elapsed; "breached" is past 100%.
 */
export const computeSlaClock = (
    openedAt: Date,
    firstRespondedAt: Date | null,
    policy: SlaPolicyShape,
    now: Date = new Date(),
): SlaClock => {
    const openedMs = openedAt.getTime();
    const firstDueMs = openedMs + policy.firstResponseMinutes * 60_000;
    const resolutionDueMs = openedMs + policy.resolutionMinutes * 60_000;
    const nowMs = now.getTime();

    const minutesSinceOpen = Math.max(0, Math.floor((nowMs - openedMs) / 60_000));
    const minutesToFirstResponseDue = Math.floor((firstDueMs - nowMs) / 60_000);
    const minutesToResolutionDue = Math.floor((resolutionDueMs - nowMs) / 60_000);
    const minutesSinceFirstResponse = firstRespondedAt
        ? Math.max(0, Math.floor((nowMs - firstRespondedAt.getTime()) / 60_000))
        : null;

    const percentElapsedFirst = Math.min(
        150,
        Math.round((minutesSinceOpen / Math.max(1, policy.firstResponseMinutes)) * 100),
    );
    const percentElapsedResolution = Math.min(
        150,
        Math.round((minutesSinceOpen / Math.max(1, policy.resolutionMinutes)) * 100),
    );

    const firstResponseState: SlaClock["firstResponseState"] = (() => {
        if (firstRespondedAt) return "satisfied";
        if (minutesToFirstResponseDue <= 0) return "breached";
        if (percentElapsedFirst >= 80) return "warning";
        return "on-track";
    })();

    const resolutionState: SlaClock["resolutionState"] = (() => {
        if (minutesToResolutionDue <= 0) return "breached";
        if (percentElapsedResolution >= 80) return "warning";
        return "on-track";
    })();

    return {
        firstResponseState,
        resolutionState,
        minutesSinceOpen,
        minutesToFirstResponseDue,
        minutesToResolutionDue,
        minutesSinceFirstResponse,
        percentElapsedFirst,
        percentElapsedResolution,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append a row to the support `AuditLog` table. Best-effort — never throws
 * inside the parent operation (catches + logs).
 */
export const recordAuditEvent = async (input: {
    actorId: string | null;
    kind:
        | "TICKET_CREATED"
        | "TICKET_ASSIGNED"
        | "TICKET_REASSIGNED"
        | "TICKET_ESCALATED"
        | "TICKET_RESOLVED"
        | "TICKET_CLOSED"
        | "TICKET_REOPENED"
        | "MESSAGE_POSTED"
        | "INTERNAL_NOTE_ADDED"
        | "PRIORITY_CHANGED"
        | "STATUS_CHANGED"
        | "MACRO_APPLIED"
        | "ARTICLE_PUBLISHED"
        | "ARTICLE_REVISED"
        | "CUSTOMER_FLAGGED";
    targetRef: string;
    ticketId?: string | null;
    organizationId?: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
    metadata?: unknown;
    customerVisible?: boolean;
}): Promise<void> => {
    try {
        await prisma.auditLog.create({
            data: {
                actorId: input.actorId,
                kind: input.kind,
                targetRef: input.targetRef,
                ticketId: input.ticketId ?? null,
                organizationId: input.organizationId ?? null,
                beforeJson: (input.beforeJson ?? null) as never,
                afterJson: (input.afterJson ?? null) as never,
                metadata: (input.metadata ?? null) as never,
                customerVisible: input.customerVisible ?? false,
            },
        });
    } catch (err) {
        // Audit logging must never break the user-facing request.
        // eslint-disable-next-line no-console
        console.error("[support] audit log write failed", err);
    }
};