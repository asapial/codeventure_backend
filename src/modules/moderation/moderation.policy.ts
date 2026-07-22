/**
 * Staff-side Moderation Console — mounted under `/api/v1/moderation`.
 *
 * Distinct from the customer-facing portal and the staff support console.
 * Gated to system roles `MODERATOR` and `ADMIN` (admins can act as a
 * moderator; the inverse is not true).
 *
 * The wire-format helpers (DB enum → kebab-case) intentionally mirror
 * `support.policy.ts` so the frontend can map them through the same
 * conventions.
 */

import status from "http-status";

import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role } from "../../../prisma/generated/prisma/enums";

// ─── Authorisation ────────────────────────────────────────────────────────

/**
 * Roles allowed into the moderation console. STUDENT and TEACHER are
 * excluded — the console is for staff content moderators (and admins).
 */
export const MODERATOR_ROLES: readonly Role[] = [
    Role.ADMIN,
    Role.MODERATOR,
] as const;

/**
 * Confirm the current user is allowed inside the moderation console.
 * Throws 403 if the caller's system role isn't `ADMIN` or `MODERATOR`.
 */
export const requireModeratorOrAdmin = async (
    userId: string,
): Promise<{
    id: string;
    role: Role;
    name: string | null;
    email: string;
}> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
            name: true,
            email: true,
            isDeleted: true,
            isActive: true,
        },
    });
    if (!user || user.isDeleted || !user.isActive) {
        throw new AppError(
            status.FORBIDDEN,
            "Moderation console access denied.",
        );
    }
    if (!MODERATOR_ROLES.includes(user.role)) {
        throw new AppError(
            status.FORBIDDEN,
            "Only moderators and admins can access the moderation console.",
            { code: "MODERATOR_REQUIRED" },
        );
    }
    return { id: user.id, role: user.role, name: user.name, email: user.email };
};

// ─── Wire-format mappers (DB enum → camelCase / kebab-case) ───────────────

export const toWireModerationStatus = (
    db: string,
): "queued" | "in-review" | "decided" | "escalated" | "closed" => {
    switch (db) {
        case "IN_REVIEW":
            return "in-review";
        case "DECIDED":
            return "decided";
        case "ESCALATED":
            return "escalated";
        case "CLOSED":
            return "closed";
        case "QUEUED":
        default:
            return "queued";
    }
};

export const toWireModerationDecision = (
    db: string,
): "approved" | "changes-requested" | "blocked" | "escalated" => {
    switch (db) {
        case "CHANGES_REQUESTED":
            return "changes-requested";
        case "BLOCKED":
            return "blocked";
        case "ESCALATED":
            return "escalated";
        case "APPROVED":
        default:
            return "approved";
    }
};

export const toWireModerationReason = (
    db: string | null | undefined,
):
    | "quality"
    | "accuracy"
    | "brand-voice"
    | "copyright"
    | "privacy-pii"
    | "sensitive-topic"
    | "spam-promotional"
    | "off-topic"
    | "outdated"
    | "legal-disclosure-missing"
    | "testimonial-consent-missing"
    | "media-infected"
    | "media-prohibited"
    | "accessibility"
    | "other"
    | null => {
    if (!db) return null;
    switch (db) {
        case "QUALITY":
            return "quality";
        case "ACCURACY":
            return "accuracy";
        case "BRAND_VOICE":
            return "brand-voice";
        case "COPYRIGHT":
            return "copyright";
        case "PRIVACY_PII":
            return "privacy-pii";
        case "SENSITIVE_TOPIC":
            return "sensitive-topic";
        case "SPAM_PROMOTIONAL":
            return "spam-promotional";
        case "OFF_TOPIC":
            return "off-topic";
        case "OUTDATED":
            return "outdated";
        case "LEGAL_DISCLOSURE_MISSING":
            return "legal-disclosure-missing";
        case "TESTIMONIAL_CONSENT_MISSING":
            return "testimonial-consent-missing";
        case "MEDIA_INFECTED":
            return "media-infected";
        case "MEDIA_PROHIBITED":
            return "media-prohibited";
        case "ACCESSIBILITY":
            return "accessibility";
        case "OTHER":
        default:
            return "other";
    }
};

export const toWireRiskLevel = (
    db: string,
): "low" | "medium" | "high" | "critical" => {
    switch (db) {
        case "LOW":
            return "low";
        case "HIGH":
            return "high";
        case "CRITICAL":
            return "critical";
        case "MEDIUM":
        default:
            return "medium";
    }
};

export const toWireContentType = (
    db: string,
):
    | "blog-post"
    | "portfolio-case-study"
    | "testimonial"
    | "media-asset"
    | "client-publication" => {
    switch (db) {
        case "PORTFOLIO_CASE_STUDY":
            return "portfolio-case-study";
        case "TESTIMONIAL":
            return "testimonial";
        case "MEDIA_ASSET":
            return "media-asset";
        case "CLIENT_PUBLICATION":
            return "client-publication";
        case "BLOG_POST":
        default:
            return "blog-post";
    }
};

export const toWireClientDisplayScope = (
    db: string,
):
    | "internal-only"
    | "password-protected"
    | "public-reference"
    | "public-featured" => {
    switch (db) {
        case "PASSWORD_PROTECTED":
            return "password-protected";
        case "PUBLIC_REFERENCE":
            return "public-reference";
        case "PUBLIC_FEATURED":
            return "public-featured";
        case "INTERNAL_ONLY":
        default:
            return "internal-only";
    }
};

export const toWireTestimonialConsentScope = (
    db: string,
):
    | "not-granted"
    | "internal-reference-only"
    | "public-reference"
    | "public-featured"
    | "public-with-name-and-photo"
    | "public-paid-case-study" => {
    switch (db) {
        case "INTERNAL_REFERENCE_ONLY":
            return "internal-reference-only";
        case "PUBLIC_REFERENCE":
            return "public-reference";
        case "PUBLIC_FEATURED":
            return "public-featured";
        case "PUBLIC_WITH_NAME_AND_PHOTO":
            return "public-with-name-and-photo";
        case "PUBLIC_PAID_CASE_STUDY":
            return "public-paid-case-study";
        case "NOT_GRANTED":
        default:
            return "not-granted";
    }
};

export const toWireMediaScanStatus = (
    db: string,
): "pending" | "clean" | "infected" | "prohibited-content" | "scan-failed" => {
    switch (db) {
        case "CLEAN":
            return "clean";
        case "INFECTED":
            return "infected";
        case "PROHIBITED_CONTENT":
            return "prohibited-content";
        case "SCAN_FAILED":
            return "scan-failed";
        case "PENDING":
        default:
            return "pending";
    }
};

export const toWireMediaVisibility = (
    db: string,
): "private" | "internal-team" | "public-reference" | "public-featured" => {
    switch (db) {
        case "INTERNAL_TEAM":
            return "internal-team";
        case "PUBLIC_REFERENCE":
            return "public-reference";
        case "PUBLIC_FEATURED":
            return "public-featured";
        case "PRIVATE":
        default:
            return "private";
    }
};

// ─── Date / number helpers ────────────────────────────────────────────────

export const toIso = (d: Date | null | undefined): string | null =>
    d ? d.toISOString() : null;

/** Whole minutes between two dates, floored. Returns null if `from` missing. */
export const diffMinutes = (
    from: Date | null | undefined,
    to: Date = new Date(),
): number | null => {
    if (!from) return null;
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
};

/** Whole hours between two dates, floored. */
export const diffHours = (
    from: Date | null | undefined,
    to: Date = new Date(),
): number | null => {
    const m = diffMinutes(from, to);
    return m === null ? null : Math.floor(m / 60);
};

// ─── Audit log ────────────────────────────────────────────────────────────

/**
 * Append a row to the existing `AuditLog` table using a moderation
 * `AuditEventType`. Best-effort — never throws inside the parent
 * operation (catches + logs).
 */
export const recordModerationAuditEvent = async (input: {
    actorId: string | null;
    kind:
        | "CONTENT_APPROVED"
        | "CONTENT_BLOCKED"
        | "CONTENT_CHANGES_REQUESTED"
        | "CONTENT_ESCALATED"
        | "MEDIA_QUARANTINED"
        | "MEDIA_CLEARED"
        | "TESTIMONIAL_CONSENT_VERIFIED"
        | "CLIENT_PUBLICATION_APPROVED"
        | "CLIENT_PUBLICATION_REVOKED";
    targetRef: string;
    contentType?: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
    metadata?: unknown;
    customerVisible?: boolean;
}): Promise<void> => {
    try {
        // Use the existing AuditLog table for cross-team forensic reads.
        // AuditEventType now carries the 9 moderation kinds, so no cast.
        await prisma.auditLog.create({
            data: {
                actorId: input.actorId,
                kind: input.kind,
                targetRef: input.targetRef,
                ticketId: null,
                organizationId: null,
                beforeJson: (input.beforeJson ?? null) as never,
                afterJson: (input.afterJson ?? null) as never,
                metadata: (input.metadata ?? null) as never,
                customerVisible: input.customerVisible ?? false,
            },
        });
    } catch (err) {
        // Audit logging must never break the user-facing request.
        // eslint-disable-next-line no-console
        console.error("[moderation] audit log write failed", err);
    }
};