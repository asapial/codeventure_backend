/**
 * M2 — Unified Review Queue service.
 *
 * Cross-surface queue + the cross-surface "decide" dispatcher. Each
 * surface (BlogPost / PortfolioCaseStudy / Testimonial / MalwareScan)
 * owns its own decide logic; the dispatcher here figures out which
 * surface owns a given review id and delegates.
 *
 * Concurrency: every writable row carries `version Int @default(0)`.
 * Decisions use OCC: `expectedVersion` must match the current row.
 * Mismatch → 409.
 *
 * Idempotency: every decide call is keyed by `(reviewerId,
 * idempotencyKey)` against the `ModerationReview` log. Replays return
 * the stored decision with `idempotentReplay: true` and never write.
 */

import status from "http-status";

import AppError from "../../../errorHelpers/AppError";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import {
    ContentType,
    ModerationStatus,
} from "../../../../prisma/generated/prisma/enums";
import {
    recordModerationAuditEvent,
    toIso,
    toWireMediaScanStatus,
    toWireModerationReason,
    toWireModerationStatus,
    toWireRiskLevel,
    toWireTestimonialConsentScope,
    toWireClientDisplayScope,
} from "../moderation.policy";
import { parsePagination, truncate } from "../moderation.utils";
import { blogService } from "../blog/blog.service";
import { portfolioService } from "../portfolio/portfolio.service";
import { testimonialsService } from "../testimonials/testimonials.service";
import type { IDecideReviewBody, IListReviewsQuery } from "./reviews.validation";
import type {
    IBlogPostQueueRow,
    IMediaQueueRow,
    IPortfolioCaseQueueRow,
    IReviewDecideResponse,
    IReviewDetailResponse,
    IReviewQueueListResponse,
    IReviewQueueRow,
    ITestimonialQueueRow,
} from "./reviews.type";

const OPEN_STATUSES: ModerationStatus[] = ["QUEUED", "IN_REVIEW", "ESCALATED"];

// ─── Common where-clause builders ────────────────────────────────────────────

type SortField = "createdAt" | "lastReviewedAt" | "riskLevel" | "submittedAt";
type SortOrder = "asc" | "desc";

const buildOrderBy = (sort: SortField, order: SortOrder) => {
    const dir = order;
    switch (sort) {
        case "lastReviewedAt":
            return { lastReviewedAt: dir } as const;
        case "riskLevel":
            return { riskLevel: dir } as const;
        case "submittedAt":
            return { createdAt: dir } as const;
        case "createdAt":
        default:
            return { createdAt: dir } as const;
    }
};

const buildSearchFilter = (
    search: string | undefined,
    fields: string[],
): Record<string, unknown> | undefined => {
    if (!search) return undefined;
    return {
        OR: fields.map((f) => ({
            [f]: { contains: search, mode: "insensitive" },
        })),
    };
};

const mergeWhere = (
    base: Record<string, unknown>,
    extra: Record<string, unknown> | undefined,
): Record<string, unknown> => {
    if (!extra) return base;
    return { AND: [base, extra] };
};

// ─── Per-surface listers ────────────────────────────────────────────────────

const listBlogRows = async (
    q: IListReviewsQuery,
    skip: number,
    take: number,
): Promise<IBlogPostQueueRow[]> => {
    const base: Record<string, unknown> = {
        status: {
            in:
                q.status && !q.onlyOpen
                    ? [q.status.toUpperCase().replace(/-/g, "_")]
                    : (OPEN_STATUSES as unknown as string[]),
        },
    };
    if (q.riskLevel) base.riskLevel = q.riskLevel.toUpperCase();
    if (q.submittedById) base.submittedById = q.submittedById;

    const where = mergeWhere(
        base,
        buildSearchFilter(q.search, ["title", "authorName", "postSlug"]),
    );

    const rows = await prisma.blogPost.findMany({
        where,
        orderBy: buildOrderBy(q.sort ?? "createdAt", q.order ?? "desc"),
        skip,
        take,
        select: {
            id: true,
            postSlug: true,
            title: true,
            authorName: true,
            wordCount: true,
            status: true,
            riskLevel: true,
            lastReasonCode: true,
            lastReasonNote: true,
            lastReviewedAt: true,
            createdAt: true,
            version: true,
            submittedBy: { select: { name: true, email: true } },
            lastReviewedBy: { select: { name: true, email: true } },
            coverAsset: { select: { secureUrl: true } },
        },
    });

    return rows.map((r) => ({
        kind: "BLOG_POST" as const,
        id: r.id,
        postSlug: r.postSlug,
        title: r.title,
        authorName: r.authorName,
        wordCount: r.wordCount,
        coverUrl: r.coverAsset?.secureUrl ?? null,
        status: toWireModerationStatus(r.status),
        riskLevel: toWireRiskLevel(r.riskLevel),
        lastReasonCode: toWireModerationReason(r.lastReasonCode),
        lastReasonNote: r.lastReasonNote ?? null,
        lastReviewedAt: toIso(r.lastReviewedAt),
        lastReviewedByName: r.lastReviewedBy?.name ?? null,
        lastReviewedByEmail: r.lastReviewedBy?.email ?? null,
        submittedByName: r.submittedBy?.name ?? null,
        submittedByEmail: r.submittedBy?.email ?? null,
        submittedAt: toIso(r.createdAt) ?? "",
        version: r.version,
    }));
};

const listPortfolioRows = async (
    q: IListReviewsQuery,
    skip: number,
    take: number,
): Promise<IPortfolioCaseQueueRow[]> => {
    const base: Record<string, unknown> = {
        status: {
            in:
                q.status && !q.onlyOpen
                    ? [q.status.toUpperCase().replace(/-/g, "_")]
                    : (OPEN_STATUSES as unknown as string[]),
        },
    };
    if (q.riskLevel) base.riskLevel = q.riskLevel.toUpperCase();
    if (q.submittedById) base.submittedById = q.submittedById;

    const where = mergeWhere(
        base,
        buildSearchFilter(q.search, [
            "title",
            "clientName",
            "caseSlug",
        ]),
    );

    const rows = await prisma.portfolioCaseStudy.findMany({
        where,
        orderBy: buildOrderBy(q.sort ?? "createdAt", q.order ?? "desc"),
        skip,
        take,
        select: {
            id: true,
            caseSlug: true,
            title: true,
            clientName: true,
            status: true,
            riskLevel: true,
            consentScope: true,
            consentMissing: true,
            lastReasonCode: true,
            lastReasonNote: true,
            lastReviewedAt: true,
            createdAt: true,
            version: true,
            submittedBy: { select: { name: true, email: true } },
            lastReviewedBy: { select: { name: true, email: true } },
            heroAsset: { select: { secureUrl: true } },
        },
    });

    return rows.map((r) => ({
        kind: "PORTFOLIO_CASE_STUDY" as const,
        id: r.id,
        caseSlug: r.caseSlug,
        title: r.title,
        clientName: r.clientName,
        heroUrl: r.heroAsset?.secureUrl ?? null,
        consentScope: toWireClientDisplayScope(r.consentScope),
        consentMissing: r.consentMissing,
        status: toWireModerationStatus(r.status),
        riskLevel: toWireRiskLevel(r.riskLevel),
        lastReasonCode: toWireModerationReason(r.lastReasonCode),
        lastReasonNote: r.lastReasonNote ?? null,
        lastReviewedAt: toIso(r.lastReviewedAt),
        lastReviewedByName: r.lastReviewedBy?.name ?? null,
        lastReviewedByEmail: r.lastReviewedBy?.email ?? null,
        submittedByName: r.submittedBy?.name ?? null,
        submittedByEmail: r.submittedBy?.email ?? null,
        submittedAt: toIso(r.createdAt) ?? "",
        version: r.version,
    }));
};

const listTestimonialRows = async (
    q: IListReviewsQuery,
    skip: number,
    take: number,
): Promise<ITestimonialQueueRow[]> => {
    const base: Record<string, unknown> = {
        status: {
            in:
                q.status && !q.onlyOpen
                    ? [q.status.toUpperCase().replace(/-/g, "_")]
                    : (OPEN_STATUSES as unknown as string[]),
        },
    };
    if (q.riskLevel) base.riskLevel = q.riskLevel.toUpperCase();
    if (q.submittedById) base.submittedById = q.submittedById;

    const where = mergeWhere(
        base,
        buildSearchFilter(q.search, [
            "customerName",
            "customerCompany",
            "handle",
        ]),
    );

    const rows = await prisma.testimonial.findMany({
        where,
        orderBy: buildOrderBy(q.sort ?? "createdAt", q.order ?? "desc"),
        skip,
        take,
        select: {
            id: true,
            handle: true,
            customerName: true,
            customerCompany: true,
            rating: true,
            body: true,
            status: true,
            riskLevel: true,
            consentScope: true,
            consentVerified: true,
            lastReasonCode: true,
            lastReasonNote: true,
            lastReviewedAt: true,
            createdAt: true,
            version: true,
            submittedBy: { select: { name: true, email: true } },
            lastReviewedBy: { select: { name: true, email: true } },
            avatarAsset: { select: { secureUrl: true } },
        },
    });

    return rows.map((r) => ({
        kind: "TESTIMONIAL" as const,
        id: r.id,
        handle: r.handle,
        customerName: r.customerName,
        customerCompany: r.customerCompany,
        rating: r.rating,
        bodyPreview: truncate(r.body, 200),
        avatarUrl: r.avatarAsset?.secureUrl ?? null,
        consentScope: toWireTestimonialConsentScope(r.consentScope),
        consentVerified: r.consentVerified,
        status: toWireModerationStatus(r.status),
        riskLevel: toWireRiskLevel(r.riskLevel),
        lastReasonCode: toWireModerationReason(r.lastReasonCode),
        lastReasonNote: r.lastReasonNote ?? null,
        lastReviewedAt: toIso(r.lastReviewedAt),
        lastReviewedByName: r.lastReviewedBy?.name ?? null,
        lastReviewedByEmail: r.lastReviewedBy?.email ?? null,
        submittedByName: r.submittedBy?.name ?? null,
        submittedByEmail: r.submittedBy?.email ?? null,
        submittedAt: toIso(r.createdAt) ?? "",
        version: r.version,
    }));
};

const listMediaRows = async (
    q: IListReviewsQuery,
    skip: number,
    take: number,
): Promise<IMediaQueueRow[]> => {
    // Media triage only shows pending/problematic scans; clean scans are
    // surfaced elsewhere.
    const base: Record<string, unknown> = {
        status: {
            in: ["PENDING", "INFECTED", "PROHIBITED_CONTENT", "SCAN_FAILED"],
        },
    };

    const where = mergeWhere(base, undefined);

    const rows = await prisma.malwareScan.findMany({
        where,
        orderBy: buildOrderBy(q.sort ?? "createdAt", q.order ?? "desc") as
            | Prisma.MalwareScanOrderByWithRelationInput
            | Prisma.MalwareScanOrderByWithRelationInput[],
        skip,
        take,
        select: {
            id: true,
            fileAssetId: true,
            status: true,
            startedAt: true,
            completedAt: true,
            fileAsset: {
                select: {
                    secureUrl: true,
                    mimeType: true,
                    sizeBytes: true,
                    fileName: true,
                },
            },
        },
    });

    return rows.map((r) => ({
        kind: "MEDIA" as const,
        id: r.id,
        fileAssetId: r.fileAssetId,
        secureUrl: r.fileAsset?.secureUrl ?? "",
        mimeType: r.fileAsset?.mimeType ?? "application/octet-stream",
        bytes: r.fileAsset?.sizeBytes ?? 0,
        scanStatus: toWireMediaScanStatus(r.status),
        fileUsageCount: 0,
        targetRef: `file_asset:${r.fileAssetId}`,
        status: toWireModerationStatus("QUEUED"),
        riskLevel: toWireRiskLevel(
            r.status === "INFECTED" || r.status === "PROHIBITED_CONTENT"
                ? "HIGH"
                : "MEDIUM",
        ),
        lastReasonCode: null,
        lastReasonNote: null,
        lastReviewedAt: toIso(r.completedAt),
        lastReviewedByName: null,
        lastReviewedByEmail: null,
        submittedByName: null,
        submittedByEmail: null,
        submittedAt: toIso(r.startedAt) ?? "",
        version: 0,
    }));
};

// ─── List queue ─────────────────────────────────────────────────────────────

const listReviews = async (input: {
    actorUserId: string;
    query: IListReviewsQuery;
}): Promise<IReviewQueueListResponse> => {
    // Require moderator role.
    const { requireModeratorOrAdmin } = await import("../moderation.policy");
    await requireModeratorOrAdmin(input.actorUserId);

    const q = input.query;
    const { page, pageSize, skip, take } = parsePagination(q);

    const onlyThisSurface = q.contentType
        ? q.contentType.toLowerCase().replace(/-/g, "_")
        : null;
    const onlyThisSurfaceUi = q.contentType;

    const wantBlog =
        onlyThisSurface === null || onlyThisSurface === "blog_post";
    const wantPortfolio =
        onlyThisSurface === null || onlyThisSurface === "portfolio_case_study";
    const wantTestimonial =
        onlyThisSurface === null || onlyThisSurface === "testimonial";
    const wantMedia =
        onlyThisSurface === null || onlyThisSurface === "media_asset";

    // Run all four queries in parallel (each may be a no-op if filtered out).
    const [blogRows, portfolioRows, testimonialRows, mediaRows, counts] =
        await Promise.all([
            wantBlog
                ? listBlogRows(q, skip, take)
                : Promise.resolve([] as IBlogPostQueueRow[]),
            wantPortfolio
                ? listPortfolioRows(q, skip, take)
                : Promise.resolve([] as IPortfolioCaseQueueRow[]),
            wantTestimonial
                ? listTestimonialRows(q, skip, take)
                : Promise.resolve([] as ITestimonialQueueRow[]),
            wantMedia
                ? listMediaRows(q, skip, take)
                : Promise.resolve([] as IMediaQueueRow[]),
            Promise.all([
                wantBlog ? prisma.blogPost.count({
                    where: {
                        status: { in: OPEN_STATUSES },
                    },
                }) : 0,
                wantPortfolio ? prisma.portfolioCaseStudy.count({
                    where: {
                        status: { in: OPEN_STATUSES },
                    },
                }) : 0,
                wantTestimonial ? prisma.testimonial.count({
                    where: {
                        status: { in: OPEN_STATUSES },
                    },
                }) : 0,
                wantMedia ? prisma.malwareScan.count({
                    where: {
                        status: {
                            in: [
                                "PENDING",
                                "INFECTED",
                                "PROHIBITED_CONTENT",
                                "SCAN_FAILED",
                            ],
                        },
                    },
                }) : 0,
            ]),
        ]);

    const [blogCount, portfolioCount, testimonialCount, mediaCount] = counts;
    const total = blogCount + portfolioCount + testimonialCount + mediaCount;

    const items: IReviewQueueRow[] = [
        ...blogRows,
        ...portfolioRows,
        ...testimonialRows,
        ...mediaRows,
    ];

    return {
        items,
        page,
        pageSize,
        total,
        counts: {
            blogPost: blogCount,
            portfolioCase: portfolioCount,
            testimonial: testimonialCount,
            media: mediaCount,
        },
        // Echo back the content-type filter so callers can introspect the slice.
        ...(onlyThisSurfaceUi
            ? ({ filteredTo: onlyThisSurfaceUi } as Record<string, unknown>)
            : {}),
    } as IReviewQueueListResponse;
};

// ─── Get a single review (cross-surface) ────────────────────────────────────

const getReview = async (input: {
    actorUserId: string;
    reviewId: string;
}): Promise<IReviewDetailResponse> => {
    const { requireModeratorOrAdmin } = await import("../moderation.policy");
    await requireModeratorOrAdmin(input.actorUserId);
    const id = input.reviewId;

    // Try BlogPost first (the most-touched surface).
    const blog = await prisma.blogPost.findUnique({
        where: { id },
        select: {
            id: true,
            postSlug: true,
            title: true,
            authorName: true,
            wordCount: true,
            status: true,
            riskLevel: true,
            lastReasonCode: true,
            lastReasonNote: true,
            createdAt: true,
            updatedAt: true,
            lastReviewedAt: true,
            version: true,
            submittedBy: { select: { name: true, email: true } },
            lastReviewedBy: { select: { name: true, email: true } },
            coverAsset: { select: { secureUrl: true } },
        },
    });
    if (blog) {
        return {
            kind: "BLOG_POST",
            id: blog.id,
            title: blog.title,
            postSlug: blog.postSlug,
            authorName: blog.authorName,
            coverUrl: blog.coverAsset?.secureUrl ?? null,
            status: toWireModerationStatus(blog.status),
            riskLevel: toWireRiskLevel(blog.riskLevel),
            lastReasonCode: toWireModerationReason(blog.lastReasonCode),
            lastReasonNote: blog.lastReasonNote ?? null,
            lastReviewedAt: toIso(blog.lastReviewedAt),
            lastReviewedByName: blog.lastReviewedBy?.name ?? null,
            lastReviewedByEmail: blog.lastReviewedBy?.email ?? null,
            submittedByName: blog.submittedBy?.name ?? null,
            submittedByEmail: blog.submittedBy?.email ?? null,
            submittedAt: toIso(blog.createdAt) ?? "",
            updatedAt: toIso(blog.updatedAt) ?? "",
            version: blog.version,
        };
    }

    // Then PortfolioCaseStudy.
    const portfolio = await prisma.portfolioCaseStudy.findUnique({
        where: { id },
        select: {
            id: true,
            caseSlug: true,
            title: true,
            clientName: true,
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
            submittedBy: { select: { name: true, email: true } },
            lastReviewedBy: { select: { name: true, email: true } },
            heroAsset: { select: { secureUrl: true } },
        },
    });
    if (portfolio) {
        return {
            kind: "PORTFOLIO_CASE_STUDY",
            id: portfolio.id,
            title: portfolio.title,
            caseSlug: portfolio.caseSlug,
            clientName: portfolio.clientName,
            heroUrl: portfolio.heroAsset?.secureUrl ?? null,
            consentScope: toWireClientDisplayScope(portfolio.consentScope),
            consentMissing: portfolio.consentMissing,
            status: toWireModerationStatus(portfolio.status),
            riskLevel: toWireRiskLevel(portfolio.riskLevel),
            lastReasonCode: toWireModerationReason(portfolio.lastReasonCode),
            lastReasonNote: portfolio.lastReasonNote ?? null,
            lastReviewedAt: toIso(portfolio.lastReviewedAt),
            lastReviewedByName: portfolio.lastReviewedBy?.name ?? null,
            lastReviewedByEmail: portfolio.lastReviewedBy?.email ?? null,
            submittedByName: portfolio.submittedBy?.name ?? null,
            submittedByEmail: portfolio.submittedBy?.email ?? null,
            submittedAt: toIso(portfolio.createdAt) ?? "",
            updatedAt: toIso(portfolio.updatedAt) ?? "",
            version: portfolio.version,
        };
    }

    // Then Testimonial.
    const testimonial = await prisma.testimonial.findUnique({
        where: { id },
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
            updatedAt: true,
            lastReviewedAt: true,
            version: true,
            submittedBy: { select: { name: true, email: true } },
            lastReviewedBy: { select: { name: true, email: true } },
            avatarAsset: { select: { secureUrl: true } },
        },
    });
    if (testimonial) {
        return {
            kind: "TESTIMONIAL",
            id: testimonial.id,
            title: testimonial.customerName,
            handle: testimonial.handle,
            customerName: testimonial.customerName,
            customerCompany: testimonial.customerCompany,
            customerRole: testimonial.customerRole,
            rating: testimonial.rating,
            bodyPreview: truncate(testimonial.body, 240),
            countryCode: testimonial.countryCode,
            avatarUrl: testimonial.avatarAsset?.secureUrl ?? null,
            consentScope: toWireTestimonialConsentScope(
                testimonial.consentScope,
            ),
            consentVerified: testimonial.consentVerified,
            status: toWireModerationStatus(testimonial.status),
            riskLevel: toWireRiskLevel(testimonial.riskLevel),
            lastReasonCode: toWireModerationReason(testimonial.lastReasonCode),
            lastReasonNote: testimonial.lastReasonNote ?? null,
            lastReviewedAt: toIso(testimonial.lastReviewedAt),
            lastReviewedByName: testimonial.lastReviewedBy?.name ?? null,
            lastReviewedByEmail: testimonial.lastReviewedBy?.email ?? null,
            submittedByName: testimonial.submittedBy?.name ?? null,
            submittedByEmail: testimonial.submittedBy?.email ?? null,
            submittedAt: toIso(testimonial.createdAt) ?? "",
            updatedAt: toIso(testimonial.updatedAt) ?? "",
            version: testimonial.version,
        };
    }

    // Finally MalwareScan — keyed by scan id, not file asset id.
    const scan = await prisma.malwareScan.findUnique({
        where: { id },
        select: {
            id: true,
            fileAssetId: true,
            status: true,
            vendor: true,
            vendorRef: true,
            startedAt: true,
            completedAt: true,
            fileAsset: {
                select: {
                    fileName: true,
                    mimeType: true,
                    sizeBytes: true,
                    secureUrl: true,
                },
            },
        },
    });
    if (scan) {
        return {
            kind: "MEDIA",
            id: scan.id,
            title:
                scan.fileAsset?.fileName ??
                `file_asset:${scan.fileAssetId}`,
            fileAssetId: scan.fileAssetId,
            secureUrl: scan.fileAsset?.secureUrl ?? "",
            mimeType: scan.fileAsset?.mimeType ?? "application/octet-stream",
            bytes: scan.fileAsset?.sizeBytes ?? 0,
            scanStatus: toWireMediaScanStatus(scan.status),
            targetRef: `file_asset:${scan.fileAssetId}`,
            status: toWireModerationStatus("QUEUED"),
            riskLevel: toWireRiskLevel(
                scan.status === "INFECTED" ||
                    scan.status === "PROHIBITED_CONTENT"
                    ? "HIGH"
                    : "MEDIUM",
            ),
            lastReasonCode: null,
            lastReasonNote: null,
            lastReviewedAt: toIso(scan.completedAt),
            lastReviewedByName: null,
            lastReviewedByEmail: null,
            submittedByName: null,
            submittedByEmail: null,
            submittedAt: toIso(scan.startedAt) ?? "",
            updatedAt: toIso(scan.completedAt ?? scan.startedAt) ?? "",
            version: 0,
        };
    }

    throw new AppError(status.NOT_FOUND, "Review not found.");
};

// ─── Cross-surface decide dispatcher ────────────────────────────────────────

/**
 * Detect which surface owns a given review id, returning the
 * canonical Prisma `ContentType` enum value. Returns null when the id
 * doesn't exist anywhere (caller throws 404).
 */
const detectSurface = async (
    reviewId: string,
): Promise<ContentType | null> => {
    const [blog, portfolio, testimonial, scan] = await Promise.all([
        prisma.blogPost.findUnique({
            where: { id: reviewId },
            select: { id: true },
        }),
        prisma.portfolioCaseStudy.findUnique({
            where: { id: reviewId },
            select: { id: true },
        }),
        prisma.testimonial.findUnique({
            where: { id: reviewId },
            select: { id: true },
        }),
        prisma.malwareScan.findUnique({
            where: { id: reviewId },
            select: { id: true },
        }),
    ]);
    if (blog) return ContentType.BLOG_POST;
    if (portfolio) return ContentType.PORTFOLIO_CASE_STUDY;
    if (testimonial) return ContentType.TESTIMONIAL;
    if (scan) return ContentType.MEDIA_ASSET;
    return null;
};

const auditKindForDecision = (
    dbDecision: string,
): Parameters<typeof recordModerationAuditEvent>[0]["kind"] => {
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
};

const decideReview = async (input: {
    actorUserId: string;
    reviewId: string;
    body: IDecideReviewBody;
}): Promise<IReviewDecideResponse> => {
    const { requireModeratorOrAdmin } = await import("../moderation.policy");
    const moderator = await requireModeratorOrAdmin(input.actorUserId);

    const { reviewId, body } = input;
    const surface = await detectSurface(reviewId);
    if (!surface) {
        throw new AppError(status.NOT_FOUND, "Review not found.");
    }

    // Media (MalwareScan) has its own audit-only path; the surface row
    // doesn't carry a moderator-facing status field.
    if (surface === ContentType.MEDIA_ASSET) {
        const dbDecision = body.decision.toUpperCase().replace(/-/g, "_");
        const dbReason = body.reasonCode
            ? body.reasonCode.toUpperCase().replace(/-/g, "_")
            : null;

        await recordModerationAuditEvent({
            actorId: moderator.id,
            kind: auditKindForDecision(dbDecision),
            targetRef: reviewId,
            contentType: "MEDIA_ASSET",
            metadata: {
                decision: dbDecision,
                reasonCode: dbReason,
                reasonNote: body.reasonNote,
                idempotencyKey: body.idempotencyKey,
            },
        });
        return {
            kind: "MEDIA",
            id: reviewId,
            status: toWireModerationStatus("DECIDED"),
            version: 0,
            reviewId,
            idempotentReplay: false,
        };
    }

    // Otherwise delegate to the per-surface service. Each one performs
    // its own OCC + idempotency check.
    let inner:
        | { kind: string; id: string; status: string; version: number; reviewId: string; idempotentReplay: boolean };

    if (surface === ContentType.BLOG_POST) {
        const r = await blogService.decideBlogPost({
            actorUserId: input.actorUserId,
            postId: reviewId,
            body: body as unknown,
        });
        inner = { ...r, kind: "BLOG_POST" };
    } else if (surface === ContentType.PORTFOLIO_CASE_STUDY) {
        const r = await portfolioService.decidePortfolioCaseStudy({
            actorUserId: input.actorUserId,
            caseStudyId: reviewId,
            body: body as unknown,
        });
        inner = { ...r, kind: "PORTFOLIO_CASE_STUDY" };
    } else {
        const r = await testimonialsService.decideTestimonial({
            actorUserId: input.actorUserId,
            testimonialId: reviewId,
            body: body as unknown,
        });
        inner = { ...r, kind: "TESTIMONIAL" };
    }

    return {
        kind: inner.kind as
            | "BLOG_POST"
            | "PORTFOLIO_CASE_STUDY"
            | "TESTIMONIAL"
            | "MEDIA",
        id: inner.id,
        status: toWireModerationStatus(inner.status),
        version: inner.version,
        reviewId: inner.reviewId,
        idempotentReplay: inner.idempotentReplay,
    };
};

export const reviewsService = {
    listReviews,
    getReview,
    decideReview,
};