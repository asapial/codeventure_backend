/**
 * M5 — Testimonial Review service.
 *
 * List / detail / decide for `Testimonial` rows. Aligned to the real
 * Prisma schema (no `isDeleted`, fields are `customerName / customerCompany /
 * customerRole / body / handle / avatarAsset`, and decisions INSERT a new
 * `ModerationReview` row instead of updating a phantom one).
 *
 * `decideTestimonial`:
 *   - Verifies OCC + idempotency-key uniqueness against `ModerationReview`.
 *   - Stamps the surface row's `status / lastReasonCode / lastReviewedAt /
 *     lastReviewedById / lastDecisionKey / version`.
 *   - Appends an `AuditLog` row (best-effort).
 *   - Returns `idempotentReplay: true` on a replay without DB writes.
 */

import status from "http-status";
import crypto from "node:crypto";

import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    ModerationDecision,
    ModerationReason,
} from "../../../../prisma/generated/prisma/enums";
import {
    requireModeratorOrAdmin,
    recordModerationAuditEvent,
    toIso,
    toWireModerationReason,
    toWireModerationStatus,
    toWireRiskLevel,
    toWireTestimonialConsentScope,
} from "../moderation.policy";
import { parsePagination, truncate } from "../moderation.utils";
import type { IListTestimonialsQuery } from "./testimonials.validation";
import type {
    IConsentSummary,
    ITestimonialDecideResponse,
    ITestimonialDetailResponse,
    ITestimonialListResponse,
    ITestimonialRow,
} from "./testimonials.type";

const computeDecisionKey = (
    idempotencyKey: string,
    expectedVersion: number,
): string =>
    crypto
        .createHash("sha256")
        .update(`${idempotencyKey}:${expectedVersion}`)
        .digest("hex");

const OPEN_STATUSES = ["QUEUED", "IN_REVIEW", "ESCALATED"] as const;

const listTestimonials = async (input: {
    actorUserId: string;
    query: IListTestimonialsQuery;
}): Promise<ITestimonialListResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const q = input.query;
    const { page, pageSize, skip, take } = parsePagination(q);

    const where: Record<string, unknown> = {};
    if (q.status) {
        where.status = q.status.toUpperCase().replace(/-/g, "_");
    } else {
        where.status = { in: OPEN_STATUSES as unknown as string[] };
    }
    if (q.riskLevel) where.riskLevel = q.riskLevel.toUpperCase();
    if (q.submittedById) where.submittedById = q.submittedById;
    if (q.search) {
        where.OR = [
            { customerName: { contains: q.search, mode: "insensitive" } },
            { customerCompany: { contains: q.search, mode: "insensitive" } },
            { handle: { contains: q.search, mode: "insensitive" } },
            { body: { contains: q.search, mode: "insensitive" } },
        ];
    }
    if (q.consentVerified !== undefined) {
        where.consentVerified = q.consentVerified;
    }

    const orderBy = (() => {
        const dir = q.order === "asc" ? "asc" : "desc";
        switch (q.sort) {
            case "lastReviewedAt":
                return { lastReviewedAt: dir } as const;
            case "riskLevel":
                return { riskLevel: dir } as const;
            case "authorName":
                return { customerName: dir } as const;
            case "createdAt":
            default:
                return { createdAt: dir } as const;
        }
    })();

    const [rows, total] = await Promise.all([
        prisma.testimonial.findMany({
            where,
            orderBy,
            skip,
            take,
            select: {
                id: true,
                handle: true,
                customerName: true,
                customerCompany: true,
                customerRole: true,
                rating: true,
                body: true,
                countryCode: true,
                status: true,
                riskLevel: true,
                consentScope: true,
                consentVerified: true,
                lastReasonCode: true,
                lastReasonNote: true,
                createdAt: true,
                lastReviewedAt: true,
                version: true,
                submittedBy: { select: { name: true, email: true } },
                lastReviewedBy: { select: { name: true, email: true } },
                avatarAsset: { select: { secureUrl: true } },
            },
        }),
        prisma.testimonial.count({ where }),
    ]);

    const items: ITestimonialRow[] = rows.map((r) => ({
        id: r.id,
        handle: r.handle,
        customerName: r.customerName,
        customerCompany: r.customerCompany,
        customerRole: r.customerRole,
        rating: r.rating,
        bodyPreview: truncate(r.body, 200),
        countryCode: r.countryCode,
        avatarUrl: r.avatarAsset?.secureUrl ?? null,
        status: toWireModerationStatus(r.status),
        riskLevel: toWireRiskLevel(r.riskLevel),
        lastReasonCode: toWireModerationReason(r.lastReasonCode),
        lastReasonNote: r.lastReasonNote ?? null,
        submittedByName: r.submittedBy?.name ?? null,
        submittedByEmail: r.submittedBy?.email ?? null,
        submittedAt: toIso(r.createdAt) ?? "",
        lastReviewedAt: toIso(r.lastReviewedAt),
        lastReviewedByName: r.lastReviewedBy?.name ?? null,
        lastReviewedByEmail: r.lastReviewedBy?.email ?? null,
        consentVerified: r.consentVerified,
        consentScope: toWireTestimonialConsentScope(r.consentScope),
        version: r.version,
    }));

    return { items, page, pageSize, total };
};

const getTestimonial = async (input: {
    actorUserId: string;
    testimonialId: string;
}): Promise<ITestimonialDetailResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const row = await prisma.testimonial.findUnique({
        where: { id: input.testimonialId },
        select: {
            id: true,
            handle: true,
            customerName: true,
            customerCompany: true,
            customerRole: true,
            rating: true,
            body: true,
            countryCode: true,
            status: true,
            riskLevel: true,
            consentScope: true,
            consentVerified: true,
            lastReasonCode: true,
            lastReasonNote: true,
            createdAt: true,
            lastReviewedAt: true,
            version: true,
            submittedBy: { select: { id: true, name: true, email: true } },
            lastReviewedBy: {
                select: { id: true, name: true, email: true },
            },
            avatarAsset: { select: { secureUrl: true } },
            consent: {
                orderBy: { capturedAt: "desc" },
                take: 1,
                select: {
                    id: true,
                    scope: true,
                    verified: true,
                    capturedAt: true,
                    ipAddress: true,
                    userAgent: true,
                    capturedBy: { select: { name: true, email: true } },
                    signedAsset: { select: { secureUrl: true } },
                },
            },
        },
    });
    if (!row) {
        throw new AppError(status.NOT_FOUND, "Testimonial not found.");
    }

    const consentRow = row.consent[0] ?? null;
    const consent: IConsentSummary | null = consentRow
        ? {
              id: consentRow.id,
              scope: toWireTestimonialConsentScope(consentRow.scope),
              verified: consentRow.verified,
              capturedAt: toIso(consentRow.capturedAt) ?? "",
              capturedByName: consentRow.capturedBy?.name ?? null,
              signedDocUrl: consentRow.signedAsset?.secureUrl ?? null,
              ipAddress: consentRow.ipAddress,
              userAgent: consentRow.userAgent,
          }
        : null;

    return {
        id: row.id,
        handle: row.handle,
        customerName: row.customerName,
        customerCompany: row.customerCompany,
        customerRole: row.customerRole,
        rating: row.rating,
        body: row.body,
        countryCode: row.countryCode,
        avatarUrl: row.avatarAsset?.secureUrl ?? null,
        status: toWireModerationStatus(row.status),
        riskLevel: toWireRiskLevel(row.riskLevel),
        consentScope: toWireTestimonialConsentScope(row.consentScope),
        consentVerified: row.consentVerified,
        lastReasonCode: toWireModerationReason(row.lastReasonCode),
        lastReasonNote: row.lastReasonNote ?? null,
        submittedBy: row.submittedBy
            ? {
                  id: row.submittedBy.id,
                  name: row.submittedBy.name,
                  email: row.submittedBy.email,
              }
            : null,
        submittedAt: toIso(row.createdAt) ?? "",
        lastReviewedAt: toIso(row.lastReviewedAt),
        lastReviewedBy: row.lastReviewedBy
            ? {
                  id: row.lastReviewedBy.id,
                  name: row.lastReviewedBy.name,
                  email: row.lastReviewedBy.email,
              }
            : null,
        consent,
        version: row.version,
    };
};

const decideTestimonial = async (input: {
    actorUserId: string;
    testimonialId: string;
    body: unknown;
}): Promise<ITestimonialDecideResponse> => {
    const moderator = await requireModeratorOrAdmin(input.actorUserId);

    const body = input.body as {
        decision:
            | "approved"
            | "changes-requested"
            | "blocked"
            | "escalated";
        reasonCode: string | null;
        reasonNote: string | null;
        expectedVersion: number;
        idempotencyKey: string;
    };

    const decisionKey = computeDecisionKey(
        body.idempotencyKey,
        body.expectedVersion,
    );

    const existing = await prisma.testimonial.findUnique({
        where: { id: input.testimonialId },
        select: {
            id: true,
            version: true,
            lastDecisionKey: true,
            status: true,
            consentScope: true,
            consentVerified: true,
        },
    });
    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Testimonial not found.");
    }

    // Idempotency: if we've already created a ModerationReview with the
    // same (reviewer, idempotencyKey) tuple, return the stored decision.
    const priorReview = await prisma.moderationReview.findUnique({
        where: {
            reviewerId_idempotencyKey: {
                reviewerId: moderator.id,
                idempotencyKey: body.idempotencyKey,
            },
        },
        select: {
            id: true,
            contentType: true,
            testimonialId: true,
            decision: true,
            reasonCode: true,
            reasonNote: true,
            expectedVersion: true,
            createdAt: true,
        },
    });
    if (
        priorReview &&
        priorReview.testimonialId === existing.id &&
        priorReview.expectedVersion === body.expectedVersion
    ) {
        return {
            id: existing.id,
            status: toWireModerationStatus(existing.status),
            version: existing.version,
            reviewId: priorReview.id,
            idempotentReplay: true,
        };
    }

    if (existing.version !== body.expectedVersion) {
        throw new AppError(
            status.CONFLICT,
            `Testimonial has been updated since you loaded it. Current version: ${existing.version}.`,
            {
                code: "VERSION_MISMATCH",
            },
        );
    }

    // Approval guard: cannot APPROVE a testimonial with no granted scope
    // unless `consentVerified` is true (set when a moderator verified it).
    if (
        body.decision === "approved" &&
        (!existing.consentVerified ||
            existing.consentScope === "NOT_GRANTED")
    ) {
        throw new AppError(
            status.UNPROCESSABLE_ENTITY,
            "Cannot approve a testimonial with no granted consent scope.",
            { code: "TESTIMONIAL_CONSENT_REQUIRED" },
        );
    }

    const now = new Date();
    const dbDecision = body.decision.toUpperCase().replace(/-/g, "_");
    const dbReason = body.reasonCode
        ? body.reasonCode.toUpperCase().replace(/-/g, "_")
        : null;
    const newStatus =
        dbDecision === "ESCALATED" ? "ESCALATED" : "DECIDED";

    const updated = await prisma.$transaction(async (tx) => {
        const testimonial = await tx.testimonial.update({
            where: { id: existing.id },
            data: {
                status: newStatus,
                lastReasonCode: dbReason as ModerationReason | null,
                lastReasonNote: body.reasonNote ?? null,
                lastReviewedAt: now,
                lastReviewedById: moderator.id,
                lastDecisionKey: decisionKey,
                version: { increment: 1 },
            },
            select: { id: true, status: true, version: true },
        });

        // Append the immutable decision log row.
        const review = await tx.moderationReview.create({
            data: {
                contentType: "TESTIMONIAL",
                testimonialId: existing.id,
                reviewerId: moderator.id,
                decision: dbDecision as ModerationDecision,
                reasonCode: dbReason as ModerationReason | null,
                reasonNote: body.reasonNote ?? null,
                expectedVersion: body.expectedVersion,
                idempotencyKey: body.idempotencyKey,
                changeSet: {
                    before: { version: existing.version },
                    after: {
                        version: existing.version + 1,
                        status: newStatus,
                    },
                } as never,
            },
            select: { id: true },
        });

        return { ...testimonial, reviewId: review.id };
    });

    const auditKind: Parameters<
        typeof recordModerationAuditEvent
    >[0]["kind"] = (() => {
        switch (dbDecision) {
            case "APPROVED":
                return "CONTENT_APPROVED";
            case "BLOCKED":
                return "CONTENT_BLOCKED";
            case "CHANGES_REQUESTED":
                return "CONTENT_CHANGES_REQUESTED";
            case "ESCALATED":
                return "CONTENT_ESCALATED";
            default:
                return "CONTENT_APPROVED";
        }
    })();

    await recordModerationAuditEvent({
        actorId: moderator.id,
        kind: auditKind,
        targetRef: updated.id,
        contentType: "TESTIMONIAL",
        metadata: {
            decision: dbDecision,
            reasonCode: dbReason,
            reasonNote: body.reasonNote ?? null,
            decisionKey,
            reviewId: updated.reviewId,
        },
    });

    return {
        id: updated.id,
        status: toWireModerationStatus(updated.status),
        version: updated.version,
        reviewId: updated.reviewId,
        idempotentReplay: false,
    };
};

export const testimonialsService = {
    listTestimonials,
    getTestimonial,
    decideTestimonial,
};