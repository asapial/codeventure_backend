/**
 * M1 — Moderator Dashboard service.
 *
 * Single round-trip aggregation over the 4 moderation surfaces:
 *   - BlogPost
 *   - PortfolioCaseStudy
 *   - Testimonial
 *   - MalwareScan (media)
 *
 * Read-only. All mutations live in `reviews/` (M2) and the per-surface
 * submodules (M3/M4/M5/M6).
 */

import { prisma } from "../../../lib/prisma";
import {
    ModerationStatus,
} from "../../../../prisma/generated/prisma/enums";
import type { AuditEventType, MediaScanStatus } from "../../../../prisma/generated/prisma/enums";
import {
    requireModeratorOrAdmin,
    toWireContentType,
    toWireMediaScanStatus,
    toWireModerationDecision,
    toWireModerationReason,
    toWireModerationStatus,
    toWireRiskLevel,
} from "../moderation.policy";
import type {
    IModeratorDashboard,
    IModeratorDashboardKpis,
    IQueueByContentTypeRow,
    IRecentAuditRow,
    IRecentDecisionRow,
    IRiskDistributionRow,
    ITopReasonRow,
} from "./dashboard.type";

const OPEN_STATUSES: ModerationStatus[] = ["QUEUED", "IN_REVIEW", "ESCALATED"];

const MODERATION_AUDIT_KINDS: AuditEventType[] = [
    "CONTENT_APPROVED",
    "CONTENT_BLOCKED",
    "CONTENT_CHANGES_REQUESTED",
    "CONTENT_ESCALATED",
    "MEDIA_QUARANTINED",
    "MEDIA_CLEARED",
    "TESTIMONIAL_CONSENT_VERIFIED",
    "CLIENT_PUBLICATION_APPROVED",
    "CLIENT_PUBLICATION_REVOKED",
];

const getDashboard = async (
    actorUserId: string,
): Promise<IModeratorDashboard> => {
    const moderator = await requireModeratorOrAdmin(actorUserId);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
        blogByStatus,
        portfolioByStatus,
        testimonialByStatus,
        blogRisk,
        portfolioRisk,
        recentReviews,
        recentAudit,
        scanByStatus,
        decisionsLast24h,
        // "My queue" — rows attributed to me that haven't been finalised.
        myQueuedBlog,
        myQueuedPortfolio,
        myQueuedTestimonial,
        myQueuedScans,
        // Decisions I made in the past 24h.
        myDecisionsLast24h,
        // Active client publication approvals (non-expired).
        clientPublicationsQueued,
    ] = await Promise.all([
        prisma.blogPost.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        prisma.portfolioCaseStudy.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        prisma.testimonial.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        prisma.blogPost.groupBy({
            by: ["riskLevel"],
            where: { status: { in: OPEN_STATUSES } },
            _count: { _all: true },
        }),
        prisma.portfolioCaseStudy.groupBy({
            by: ["riskLevel"],
            where: { status: { in: OPEN_STATUSES } },
            _count: { _all: true },
        }),
        // NOTE: Testimonial does not have a `riskLevel` scalar field, so risk
        // rollup for testimonials is intentionally omitted. Only BlogPost and
        // PortfolioCaseStudy contribute to the high/critical risk KPIs.
        prisma.moderationReview.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
                id: true,
                contentType: true,
                decision: true,
                reasonCode: true,
                createdAt: true,
                reviewerId: true,
                blogPostId: true,
                caseStudyId: true,
                testimonialId: true,
                fileAssetTargetRef: true,
                reviewer: { select: { name: true, email: true } },
                blogPost: { select: { title: true } },
                caseStudy: { select: { title: true } },
                testimonial: { select: { customerName: true } },
            },
        }),
        prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 12,
            where: { kind: { in: MODERATION_AUDIT_KINDS } },
            select: {
                id: true,
                kind: true,
                targetRef: true,
                beforeJson: true,
                afterJson: true,
                createdAt: true,
                actor: { select: { name: true, email: true } },
            },
        }),
        prisma.malwareScan.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        // Top-reasons: count from the decision log over the past 24h.
        prisma.moderationReview.findMany({
            where: { createdAt: { gte: last24h } },
            select: { reasonCode: true },
        }),
        // "Open assignments" = open rows where the moderator is the submitter
        // (treats the moderator as both editor and reviewer since this
        // product does not yet ship dedicated reviewer assignment).
        prisma.blogPost.count({
            where: {
                status: { in: OPEN_STATUSES },
                submittedById: moderator.id,
            },
        }),
        prisma.portfolioCaseStudy.count({
            where: {
                status: { in: OPEN_STATUSES },
                submittedById: moderator.id,
            },
        }),
        prisma.testimonial.count({
            where: {
                status: { in: OPEN_STATUSES },
                submittedById: moderator.id,
            },
        }),
        prisma.malwareScan.count({
            where: {
                status: { in: ["PENDING"] satisfies MediaScanStatus[] },
            },
        }),
        prisma.moderationReview.count({
            where: {
                reviewerId: moderator.id,
                createdAt: { gte: last24h },
            },
        }),
        prisma.clientPublicationApproval.count({
            where: {
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
        }),
    ]);

    const makeCount = (
        rows: ReadonlyArray<{ status: unknown; _count: { _all: number } }>,
        s: string,
    ): number =>
        rows.find((r) => (r.status as string) === s)?._count._all ?? 0;

    const makeRisk = (
        rows: ReadonlyArray<{ riskLevel: unknown; _count: { _all: number } }>,
        l: string,
    ): number =>
        rows.find((r) => (r.riskLevel as string) === l)?._count._all ?? 0;

    const blogQueued =
        makeCount(blogByStatus, "QUEUED") + makeCount(blogByStatus, "IN_REVIEW");
    const portfolioQueued =
        makeCount(portfolioByStatus, "QUEUED") +
        makeCount(portfolioByStatus, "IN_REVIEW");
    const testimonialsQueued =
        makeCount(testimonialByStatus, "QUEUED") +
        makeCount(testimonialByStatus, "IN_REVIEW");
    const mediaQueued = makeCount(scanByStatus, "QUEUED") +
        makeCount(scanByStatus, "RUNNING");

    const totalQueued =
        blogQueued + portfolioQueued + testimonialsQueued + mediaQueued;
    const totalInReview =
        makeCount(blogByStatus, "IN_REVIEW") +
        makeCount(portfolioByStatus, "IN_REVIEW") +
        makeCount(testimonialByStatus, "IN_REVIEW");
    const totalEscalated =
        makeCount(blogByStatus, "ESCALATED") +
        makeCount(portfolioByStatus, "ESCALATED") +
        makeCount(testimonialByStatus, "ESCALATED");

    const highRiskOpen =
        makeRisk(blogRisk, "HIGH") +
        makeRisk(portfolioRisk, "HIGH");
    const criticalRiskOpen =
        makeRisk(blogRisk, "CRITICAL") +
        makeRisk(portfolioRisk, "CRITICAL");

    const kpis: IModeratorDashboardKpis = {
        totalQueued,
        totalInReview,
        totalDecidedLast24h: myDecisionsLast24h,
        totalEscalated,
        highRiskOpen,
        criticalRiskOpen,
        blogQueued,
        portfolioQueued,
        testimonialsQueued,
        mediaQueued,
        clientPublicationsQueued,
        meOpenAssignments:
            myQueuedBlog + myQueuedPortfolio + myQueuedTestimonial + myQueuedScans,
        meDecidedLast24h: myDecisionsLast24h,
    };

    // Queue matrix (status × surface).
    const queueByContentType: IQueueByContentTypeRow[] = [];
    const pushSurfaceStatuses = (
        contentType:
            | "BLOG_POST"
            | "PORTFOLIO_CASE_STUDY"
            | "TESTIMONIAL",
        rows: ReadonlyArray<{ status: unknown; _count: { _all: number } }>,
    ) => {
        for (const r of rows) {
            if (r._count._all <= 0) continue;
            queueByContentType.push({
                contentType: toWireContentType(contentType),
                status: toWireModerationStatus(r.status as ModerationStatus),
                count: r._count._all,
            });
        }
    };
    pushSurfaceStatuses("BLOG_POST", blogByStatus);
    pushSurfaceStatuses("PORTFOLIO_CASE_STUDY", portfolioByStatus);
    pushSurfaceStatuses("TESTIMONIAL", testimonialByStatus);
    // Media surface: MalwareScan status grouping maps onto the wire enum
    // (only the queued/running buckets are interesting for triage).
    for (const r of scanByStatus) {
        if (r._count._all <= 0) continue;
        queueByContentType.push({
            contentType: "media-asset",
            status: "queued",
            count: r._count._all,
        });
    }

    // Recent decisions — the immutable log (idempotency-aware).
    const myRecentDecisions: IRecentDecisionRow[] = recentReviews
        .filter((r) => r.reviewerId === moderator.id)
        .map((r) => {
            const title =
                r.blogPost?.title ??
                r.caseStudy?.title ??
                r.testimonial?.customerName ??
                r.fileAssetTargetRef ??
                "Untitled";
            return {
                reviewId: r.id,
                contentType: toWireContentType(r.contentType),
                contentTitle: title,
                decision: toWireModerationDecision(r.decision),
                reasonCode: toWireModerationReason(r.reasonCode),
                reviewerName: r.reviewer?.name ?? null,
                reviewerEmail: r.reviewer?.email ?? null,
                decidedAt: r.createdAt.toISOString(),
            };
        });

    // Audit feed.
    const recentAuditMapped: IRecentAuditRow[] = recentAudit.map((row) => ({
        id: row.id,
        kind: row.kind,
        actorName: row.actor?.name ?? null,
        actorEmail: row.actor?.email ?? null,
        targetRef: row.targetRef,
        contentType: null,
        summary: buildAuditSummary(row.kind, row.targetRef),
        createdAt: row.createdAt.toISOString(),
    }));

    // Top reasons (24h).
    const reasonTally = new Map<string, number>();
    for (const r of decisionsLast24h) {
        if (!r.reasonCode) continue;
        reasonTally.set(
            r.reasonCode,
            (reasonTally.get(r.reasonCode) ?? 0) + 1,
        );
    }
    const topReasons: ITopReasonRow[] = Array.from(reasonTally.entries())
        .map(([code, count]) => ({
            reasonCode: toWireModerationReason(code) ?? "other",
            count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Risk distribution over OPEN surfaces only.
    const riskTally = new Map<string, number>();
    const addRiskRows = (
        rows: ReadonlyArray<{ riskLevel: unknown; _count: { _all: number } }>,
    ) => {
        for (const r of rows) {
            const lvl = r.riskLevel as string;
            riskTally.set(
                lvl,
                (riskTally.get(lvl) ?? 0) + r._count._all,
            );
        }
    };
    addRiskRows(blogRisk);
    addRiskRows(portfolioRisk);
    const riskDistribution: IRiskDistributionRow[] = Array.from(
        riskTally.entries(),
    )
        .map(([level, count]) => ({ riskLevel: toWireRiskLevel(level), count }))
        .sort((a, b) => b.count - a.count);

    return {
        generatedAt: now.toISOString(),
        kpis,
        queueByContentType,
        myRecentDecisions,
        recentAudit: recentAuditMapped,
        topReasons,
        riskDistribution,
    };
};

const buildAuditSummary = (kind: string, targetRef: string): string => {
    switch (kind) {
        case "CONTENT_APPROVED":
            return `Approved: ${targetRef}`;
        case "CONTENT_BLOCKED":
            return `Blocked: ${targetRef}`;
        case "CONTENT_CHANGES_REQUESTED":
            return `Changes requested: ${targetRef}`;
        case "CONTENT_ESCALATED":
            return `Escalated: ${targetRef}`;
        case "MEDIA_QUARANTINED":
            return `Media quarantined: ${targetRef}`;
        case "MEDIA_CLEARED":
            return `Media cleared: ${targetRef}`;
        case "TESTIMONIAL_CONSENT_VERIFIED":
            return `Testimonial consent verified: ${targetRef}`;
        case "CLIENT_PUBLICATION_APPROVED":
            return `Client publication approved: ${targetRef}`;
        case "CLIENT_PUBLICATION_REVOKED":
            return `Client publication revoked: ${targetRef}`;
        default:
            return kind;
    }
};

export const dashboardService = { getDashboard };