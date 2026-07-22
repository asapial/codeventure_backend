/**
 * M3 — Blog Review service.
 *
 * List / detail / decide for `BlogPost` rows. Aligned to the real
 * Prisma schema: BlogPost fields are `postSlug / title / authorName /
 * wordCount / regions / coverAsset / status / riskLevel / version /
 * lastDecisionKey / lastReasonCode / lastReasonNote / lastReviewedAt /
 * lastReviewedById / submittedById / createdAt / updatedAt`.
 *
 * The decide endpoint INSERTs a new `ModerationReview` row (immutable
 * decision log) and UPDATEs the BlogPost row's inline state atomically.
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
} from "../moderation.policy";
import { parsePagination } from "../moderation.utils";
import type { IListBlogQuery } from "./blog.validation";
import type {
    IBlogPostDecideResponse,
    IBlogPostDetailResponse,
    IBlogPostListResponse,
    IBlogPostRow,
} from "./blog.type";

const OPEN_STATUSES = ["QUEUED", "IN_REVIEW", "ESCALATED"] as const;

const computeDecisionKey = (
    idempotencyKey: string,
    expectedVersion: number,
): string =>
    crypto
        .createHash("sha256")
        .update(`${idempotencyKey}:${expectedVersion}`)
        .digest("hex");

const listBlog = async (input: {
    actorUserId: string;
    query: IListBlogQuery;
}): Promise<IBlogPostListResponse> => {
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
            { title: { contains: q.search, mode: "insensitive" } },
            { postSlug: { contains: q.search, mode: "insensitive" } },
            { authorName: { contains: q.search, mode: "insensitive" } },
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
        prisma.blogPost.findMany({
            where,
            orderBy,
            skip,
            take,
            select: {
                id: true,
                postSlug: true,
                title: true,
                authorName: true,
                wordCount: true,
                regions: true,
                status: true,
                riskLevel: true,
                lastReasonCode: true,
                lastReasonNote: true,
                createdAt: true,
                lastReviewedAt: true,
                version: true,
                submittedBy: { select: { name: true, email: true } },
                lastReviewedBy: { select: { name: true, email: true } },
                coverAsset: { select: { secureUrl: true } },
            },
        }),
        prisma.blogPost.count({ where }),
    ]);

    const items: IBlogPostRow[] = rows.map((r) => ({
        id: r.id,
        postSlug: r.postSlug,
        title: r.title,
        authorName: r.authorName,
        wordCount: r.wordCount,
        regions: parseRegions(r.regions),
        coverUrl: r.coverAsset?.secureUrl ?? null,
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
        version: r.version,
    }));

    return { items, page, pageSize, total };
};

const parseRegions = (
    regions: string | string[] | null | undefined,
): string[] => {
    if (!regions) return [];
    if (Array.isArray(regions)) return regions;
    try {
        const parsed = JSON.parse(regions);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return regions.split(",").map((s) => s.trim()).filter(Boolean);
    }
};

const getBlogPost = async (input: {
    actorUserId: string;
    postId: string;
}): Promise<IBlogPostDetailResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const row = await prisma.blogPost.findUnique({
        where: { id: input.postId },
        select: {
            id: true,
            postSlug: true,
            title: true,
            authorName: true,
            wordCount: true,
            regions: true,
            status: true,
            riskLevel: true,
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
            coverAsset: { select: { secureUrl: true } },
        },
    });
    if (!row) {
        throw new AppError(status.NOT_FOUND, "Blog post not found.");
    }
    return {
        id: row.id,
        postSlug: row.postSlug,
        title: row.title,
        authorName: row.authorName,
        wordCount: row.wordCount,
        regions: parseRegions(row.regions),
        coverUrl: row.coverAsset?.secureUrl ?? null,
        status: toWireModerationStatus(row.status),
        riskLevel: toWireRiskLevel(row.riskLevel),
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
        version: row.version,
        updatedAt: toIso(row.updatedAt) ?? "",
    };
};

const decideBlogPost = async (input: {
    actorUserId: string;
    postId: string;
    body: unknown;
}): Promise<IBlogPostDecideResponse> => {
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

    const existing = await prisma.blogPost.findUnique({
        where: { id: input.postId },
        select: { id: true, version: true },
    });
    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Blog post not found.");
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
            blogPostId: true,
            expectedVersion: true,
            createdAt: true,
        },
    });
    if (
        priorReview &&
        priorReview.blogPostId === existing.id &&
        priorReview.expectedVersion === body.expectedVersion
    ) {
        const current = await prisma.blogPost.findUnique({
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
            `Blog post has been updated since you loaded it. Current version: ${existing.version}.`,
            {
                code: "VERSION_MISMATCH",
            },
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
        const post = await tx.blogPost.update({
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
                contentType: "BLOG_POST",
                blogPostId: existing.id,
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

        return { ...post, reviewId: review.id };
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
        contentType: "BLOG_POST",
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

export const blogService = {
    listBlog,
    getBlogPost,
    decideBlogPost,
};