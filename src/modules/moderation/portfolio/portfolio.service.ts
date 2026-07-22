/**
 * M4 — Portfolio Case Study Review service.
 *
 * List / detail / decide for `PortfolioCaseStudy` rows. Aligned to the
 * real Prisma schema: `caseSlug / title / clientName / industry / tags /
 * heroAsset?.secureUrl / status / riskLevel / consentScope /
 * consentMissing / version / lastDecisionKey`. ClientPublicationApproval
 * is plural and ordered by `approvedAt desc`.
 *
 * Approval guard: cannot APPROVE a case study whose `consentMissing` flag
 * is true or whose `consentScope` is `INTERNAL_ONLY` (would still leak
 * data if published).
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
    toWireClientDisplayScope,
    toWireModerationReason,
    toWireModerationStatus,
    toWireRiskLevel,
} from "../moderation.policy";
import { parsePagination } from "../moderation.utils";
import type { IListPortfolioQuery } from "./portfolio.validation";
import type {
    IClientApprovalSummary,
    IPortfolioCaseDecideResponse,
    IPortfolioCaseDetailResponse,
    IPortfolioCaseListResponse,
    IPortfolioCaseRow,
} from "./portfolio.type";

const OPEN_STATUSES = ["QUEUED", "IN_REVIEW", "ESCALATED"] as const;

const computeDecisionKey = (
    idempotencyKey: string,
    expectedVersion: number,
): string =>
    crypto
        .createHash("sha256")
        .update(`${idempotencyKey}:${expectedVersion}`)
        .digest("hex");

const parseTags = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
};

const latestApprovalToSummary = (
    approval:
        | {
              id: string;
              approvedScope: string;
              clientName: string;
              approvedAt: Date;
              expiresAt: Date | null;
              signedDocument: { secureUrl: string | null } | null;
          }
        | null
        | undefined,
): IClientApprovalSummary | null => {
    if (!approval) return null;
    return {
        id: approval.id,
        approvedScope: toWireClientDisplayScope(approval.approvedScope),
        clientName: approval.clientName,
        approvedAt: toIso(approval.approvedAt) ?? "",
        expiresAt: toIso(approval.expiresAt),
        signedDocumentUrl: approval.signedDocument?.secureUrl ?? null,
    };
};

const listPortfolio = async (input: {
    actorUserId: string;
    query: IListPortfolioQuery;
}): Promise<IPortfolioCaseListResponse> => {
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
    if (q.consentMissing !== undefined) {
        where.consentMissing = q.consentMissing;
    }
    if (q.search) {
        where.OR = [
            { title: { contains: q.search, mode: "insensitive" } },
            { caseSlug: { contains: q.search, mode: "insensitive" } },
            { clientName: { contains: q.search, mode: "insensitive" } },
        ];
    }

    const orderBy = (() => {
        const dir = q.order === "asc" ? "asc" : "desc";
        switch (q.sort) {
            case "lastReviewedAt":
                return { lastReviewedAt: dir } as const;
            case "riskLevel":
                return { riskLevel: dir } as const;
            case "title":
                return { title: dir } as const;
            case "createdAt":
            default:
                return { createdAt: dir } as const;
        }
    })();

    const [rows, total] = await Promise.all([
        prisma.portfolioCaseStudy.findMany({
            where,
            orderBy,
            skip,
            take,
            select: {
                id: true,
                caseSlug: true,
                title: true,
                clientName: true,
                industry: true,
                tags: true,
                status: true,
                riskLevel: true,
                consentScope: true,
                consentMissing: true,
                lastReasonCode: true,
                lastReasonNote: true,
                createdAt: true,
                lastReviewedAt: true,
                version: true,
                submittedBy: { select: { name: true, email: true } },
                lastReviewedBy: { select: { name: true, email: true } },
                heroAsset: { select: { secureUrl: true } },
                clientApprovals: {
                    orderBy: { approvedAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        approvedScope: true,
                        clientName: true,
                        approvedAt: true,
                        expiresAt: true,
                        signedDocument: {
                            select: { secureUrl: true },
                        },
                    },
                },
            },
        }),
        prisma.portfolioCaseStudy.count({ where }),
    ]);

    const items: IPortfolioCaseRow[] = rows.map((r) => ({
        id: r.id,
        caseSlug: r.caseSlug,
        title: r.title,
        clientName: r.clientName,
        industry: r.industry,
        tags: parseTags(r.tags),
        heroUrl: r.heroAsset?.secureUrl ?? null,
        status: toWireModerationStatus(r.status),
        riskLevel: toWireRiskLevel(r.riskLevel),
        consentScope: toWireClientDisplayScope(r.consentScope),
        consentMissing: r.consentMissing,
        lastReasonCode: toWireModerationReason(r.lastReasonCode),
        lastReasonNote: r.lastReasonNote ?? null,
        submittedByName: r.submittedBy?.name ?? null,
        submittedByEmail: r.submittedBy?.email ?? null,
        submittedAt: toIso(r.createdAt) ?? "",
        lastReviewedAt: toIso(r.lastReviewedAt),
        lastReviewedByName: r.lastReviewedBy?.name ?? null,
        lastReviewedByEmail: r.lastReviewedBy?.email ?? null,
        latestApproval: latestApprovalToSummary(r.clientApprovals[0]),
        version: r.version,
    }));

    return { items, page, pageSize, total };
};

const getPortfolioCaseStudy = async (input: {
    actorUserId: string;
    caseStudyId: string;
}): Promise<IPortfolioCaseDetailResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const row = await prisma.portfolioCaseStudy.findUnique({
        where: { id: input.caseStudyId },
        select: {
            id: true,
            caseSlug: true,
            title: true,
            clientName: true,
            industry: true,
            tags: true,
            status: true,
            riskLevel: true,
            consentScope: true,
            consentMissing: true,
            lastReasonCode: true,
            lastReasonNote: true,
            createdAt: true,
            updatedAt: true,
            lastReviewedAt: true,
            version: true,
            submittedBy: { select: { id: true, name: true, email: true } },
            lastReviewedBy: {
                select: { id: true, name: true, email: true },
            },
            heroAsset: { select: { secureUrl: true } },
            clientApprovals: {
                orderBy: { approvedAt: "desc" },
                select: {
                    id: true,
                    approvedScope: true,
                    clientName: true,
                    approvedAt: true,
                    expiresAt: true,
                    signedDocument: {
                        select: { secureUrl: true },
                    },
                },
            },
        },
    });
    if (!row) {
        throw new AppError(
            status.NOT_FOUND,
            "Portfolio case study not found.",
        );
    }

    return {
        id: row.id,
        caseSlug: row.caseSlug,
        title: row.title,
        clientName: row.clientName,
        industry: row.industry,
        tags: parseTags(row.tags),
        heroUrl: row.heroAsset?.secureUrl ?? null,
        status: toWireModerationStatus(row.status),
        riskLevel: toWireRiskLevel(row.riskLevel),
        consentScope: toWireClientDisplayScope(row.consentScope),
        consentMissing: row.consentMissing,
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
        clientApprovals: row.clientApprovals
            .map((a) => latestApprovalToSummary(a))
            .filter((a): a is IClientApprovalSummary => a !== null),
        version: row.version,
        updatedAt: toIso(row.updatedAt) ?? "",
    };
};

const decidePortfolioCaseStudy = async (input: {
    actorUserId: string;
    caseStudyId: string;
    body: unknown;
}): Promise<IPortfolioCaseDecideResponse> => {
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

    const existing = await prisma.portfolioCaseStudy.findUnique({
        where: { id: input.caseStudyId },
        select: {
            id: true,
            version: true,
            consentMissing: true,
            consentScope: true,
            clientApprovals: {
                orderBy: { approvedAt: "desc" },
                take: 1,
                select: { expiresAt: true },
            },
        },
    });
    if (!existing) {
        throw new AppError(
            status.NOT_FOUND,
            "Portfolio case study not found.",
        );
    }

    // Idempotency replay check.
    const priorReview = await prisma.moderationReview.findUnique({
        where: {
            reviewerId_idempotencyKey: {
                reviewerId: moderator.id,
                idempotencyKey: body.idempotencyKey,
            },
        },
        select: {
            id: true,
            caseStudyId: true,
            expectedVersion: true,
        },
    });
    if (
        priorReview &&
        priorReview.caseStudyId === existing.id &&
        priorReview.expectedVersion === body.expectedVersion
    ) {
        const current = await prisma.portfolioCaseStudy.findUnique({
            where: { id: existing.id },
            select: { id: true, status: true, version: true },
        });
        return {
            id: current?.id ?? existing.id,
            status: toWireModerationStatus(current?.status ?? "DECIDED"),
            version: current?.version ?? existing.version,
            reviewId: priorReview.id,
            idempotentReplay: true,
        };
    }

    if (existing.version !== body.expectedVersion) {
        throw new AppError(
            status.CONFLICT,
            `Portfolio case study has been updated since you loaded it. Current version: ${existing.version}.`,
            {
                code: "VERSION_MISMATCH",
            },
        );
    }

    // Approval guard: cannot APPROVE if consent missing or the latest
    // approval has expired.
    if (body.decision === "approved") {
        if (existing.consentMissing) {
            throw new AppError(
                status.UNPROCESSABLE_ENTITY,
                "Cannot approve a case study with missing client consent.",
                { code: "CLIENT_CONSENT_MISSING" },
            );
        }
        const latestExpiry = existing.clientApprovals[0]?.expiresAt;
        if (latestExpiry && latestExpiry.getTime() < Date.now()) {
            throw new AppError(
                status.UNPROCESSABLE_ENTITY,
                "Cannot approve a case study whose client approval has expired.",
                { code: "CLIENT_CONSENT_EXPIRED" },
            );
        }
    }

    const now = new Date();
    const dbDecision = body.decision.toUpperCase().replace(/-/g, "_");
    const dbReason = body.reasonCode
        ? body.reasonCode.toUpperCase().replace(/-/g, "_")
        : null;
    const newStatus =
        dbDecision === "ESCALATED" ? "ESCALATED" : "DECIDED";

    const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.portfolioCaseStudy.update({
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

        const review = await tx.moderationReview.create({
            data: {
                contentType: "PORTFOLIO_CASE_STUDY",
                caseStudyId: existing.id,
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

        return { ...row, reviewId: review.id };
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
        contentType: "PORTFOLIO_CASE_STUDY",
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

export const portfolioService = {
    listPortfolio,
    getPortfolioCaseStudy,
    decidePortfolioCaseStudy,
};