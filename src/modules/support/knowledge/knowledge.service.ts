/**
 * S6 — Knowledge Base service.
 *
 * CRUD over `HelpArticle`, with side-effects on `ContentRevision`
 * (every body change), `KnowledgeFeedback` (customer end), and a
 * trace `SupportJobRun` enqueue so S7 reports surfaces agent replies
 * as an audit-trailable action.
 */

import status from "http-status";

import AppError from "../../../errorHelpers/AppError";
import { Prisma, prisma } from "../../../lib/prisma";
import {
    recordAuditEvent,
    requireSupportAgent,
    toIso,
    toWireHelpArticleStatus,
} from "../support.policy";
import type {
    ChangeArticleStatusBody,
    CreateArticleBody,
    KnowledgeListQuery,
    UpdateArticleBody,
} from "./knowledge.validation";
import type {
    IArchiveArticleResult,
    IChangeStatusResult,
    ICreateArticleResult,
    IKnowledgeArticleDetail,
    IKnowledgeArticleSummary,
    IKnowledgeListResponse,
    IReplyFeedbackResult,
    IUpdateArticleResult,
} from "./knowledge.type";
import { HelpArticleStatus } from "../../../../prisma/generated/prisma/enums";

// ── Helpers ─────────────────────────────────────────────────────────────

type ArticleWithAuthor = Prisma.HelpArticleGetPayload<{
    include: { author: { select: { id: true; fullName: true; avatarUrl: true } } };
}>;

type RevisionWithAuthor = Prisma.ContentRevisionGetPayload<{
    include: { author: { select: { id: true; fullName: true } } };
}>;

type FeedbackWithUser = Prisma.KnowledgeFeedbackGetPayload<{
    include: { user: { select: { id: true; fullName: true } } };
}>;

type AttachmentWithUploader = Prisma.ArticleAttachmentGetPayload<{
    include: { uploader: { select: { id: true; fullName: true } } };
}>;

const toHelpArticleStatusDb = (
    s: "draft" | "in-review" | "published" | "archived",
): HelpArticleStatus => {
    switch (s) {
        case "in-review":
            return HelpArticleStatus.IN_REVIEW;
        case "published":
            return HelpArticleStatus.PUBLISHED;
        case "archived":
            return HelpArticleStatus.ARCHIVED;
        case "draft":
        default:
            return HelpArticleStatus.DRAFT;
    }
};

const computeHelpfulRate = (yes: number, no: number): number | null => {
    const total = yes + no;
    if (total === 0) return null;
    return Math.round((yes / total) * 1000) / 1000;
};

const buildSearchTokens = (
    title: string,
    excerpt: string | null,
    category: string,
): string => {
    const haystack = `${title} ${excerpt ?? ""} ${category}`.toLowerCase();
    return haystack.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
};

const slugify = (s: string): string =>
    s
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 80) || "article";

const ensureUniqueSlug = async (
    base: string,
    excludeId?: string,
): Promise<string> => {
    let candidate = base || "article";
    let attempt = 1;
    while (true) {
        const existing = await prisma.helpArticle.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });
        if (!existing || existing.id === excludeId) return candidate;
        attempt += 1;
        candidate = `${base}-${attempt}`;
    }
};

const mapSummary = (row: ArticleWithAuthor): IKnowledgeArticleSummary => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    status: toWireHelpArticleStatus(row.status),
    authorId: row.authorId,
    authorName: row.author?.fullName ?? null,
    viewCount: row.viewCount,
    helpfulYes: row.helpfulYes,
    helpfulNo: row.helpfulNo,
    helpfulRate: computeHelpfulRate(row.helpfulYes, row.helpfulNo),
    publishedAt: toIso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
});

// ── Queries ─────────────────────────────────────────────────────────────

const listArticles = async (
    actorUserId: string,
    query: KnowledgeListQuery,
): Promise<IKnowledgeListResponse> => {
    await requireSupportAgent(actorUserId);

    const where: Prisma.HelpArticleWhereInput = {};
    if (query.q) {
        const q = query.q.trim();
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
            { searchTokens: { contains: q.toLowerCase() } },
        ];
    }
    if (query.status) {
        where.status = toHelpArticleStatusDb(query.status);
    }
    if (query.category) {
        where.category = query.category;
    }
    if (query.authorId) {
        where.authorId = query.authorId;
    }

    const orderBy: Prisma.HelpArticleOrderByWithRelationInput = (() => {
        switch (query.sort) {
            case "updated-asc":
                return { updatedAt: "asc" };
            case "title-asc":
                return { title: "asc" };
            case "published-desc":
                return { publishedAt: "desc" };
            case "updated-desc":
            default:
                return { updatedAt: "desc" };
        }
    })();

    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await prisma.$transaction([
        prisma.helpArticle.findMany({
            where,
            orderBy,
            skip,
            take: query.pageSize,
            include: {
                author: { select: { id: true, fullName: true, avatarUrl: true } },
            },
        }),
        prisma.helpArticle.count({ where }),
    ]);

    return {
        items: rows.map(mapSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
};

const getArticle = async (
    actorUserId: string,
    articleId: string,
): Promise<IKnowledgeArticleDetail> => {
    await requireSupportAgent(actorUserId);

    const article = await prisma.helpArticle.findUnique({
        where: { id: articleId },
        include: {
            author: { select: { id: true, fullName: true, avatarUrl: true } },
            revisions: {
                orderBy: { version: "desc" },
                take: 20,
                include: {
                    author: { select: { id: true, fullName: true } },
                },
            },
            feedback: {
                orderBy: { createdAt: "desc" },
                take: 30,
                include: {
                    user: { select: { id: true, fullName: true } },
                },
            },
            attachments: {
                orderBy: { createdAt: "desc" },
                take: 20,
                include: {
                    uploader: { select: { id: true, fullName: true } },
                },
            },
        },
    });

    if (!article) {
        throw new AppError(status.NOT_FOUND, "Article not found.");
    }

    const recentFeedback = (article.feedback as FeedbackWithUser[]).map((f) => {
        // Replies are baked into the comment with a `REPLY:` prefix; split them
        // for display so the wire shape is friendly to the frontend.
        let authorReply: string | null = null;
        let comment: string | null = f.comment;
        if (f.comment && f.comment.includes("REPLY:")) {
            const idx = f.comment.indexOf("REPLY:");
            comment = f.comment.slice(0, idx).trim() || null;
            authorReply = f.comment.slice(idx + 6).trim();
        }
        return {
            id: f.id,
            wasHelpful: f.wasHelpful,
            comment,
            user:
                f.user == null
                    ? null
                    : { id: f.user.id, name: f.user.fullName },
            authorReply,
            createdAt: f.createdAt.toISOString(),
        };
    });

    const revisions = (article.revisions as RevisionWithAuthor[]).map((r) => ({
        id: r.id,
        version: r.version,
        title: r.title,
        excerpt: r.excerpt,
        changeNote: r.changeNote,
        author: { id: r.author.id, name: r.author.fullName },
        createdAt: r.createdAt.toISOString(),
    }));

    const attachments = (article.attachments as AttachmentWithUploader[]).map(
        (a) => ({
            id: a.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            altText: a.altText,
            uploader: { id: a.uploader.id, name: a.uploader.fullName },
            createdAt: a.createdAt.toISOString(),
        }),
    );

    return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,
        category: article.category,
        status: toWireHelpArticleStatus(article.status),
        author:
            article.author == null
                ? null
                : {
                    id: article.author.id,
                    name: article.author.fullName,
                    avatarUrl: article.author.avatarUrl,
                },
        viewCount: article.viewCount,
        publishedAt: toIso(article.publishedAt),
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
        revisions,
        feedback: {
            totalYes: article.helpfulYes,
            totalNo: article.helpfulNo,
            helpfulRate: computeHelpfulRate(article.helpfulYes, article.helpfulNo),
            recent: recentFeedback,
        },
        attachments,
    };
};

// ── Mutations ───────────────────────────────────────────────────────────

const createArticle = async (
    actorUserId: string,
    body: CreateArticleBody,
): Promise<ICreateArticleResult> => {
    await requireSupportAgent(actorUserId);

    const slugBase = slugify(body.title);
    const slug = await ensureUniqueSlug(slugBase);

    const created = await prisma.helpArticle.create({
        data: {
            slug,
            title: body.title,
            excerpt: body.excerpt ?? null,
            body: body.body,
            category: body.category,
            searchTokens: buildSearchTokens(body.title, body.excerpt ?? null, body.category),
            status: HelpArticleStatus.DRAFT,
            authorId: actorUserId,
        },
        select: {
            id: true,
            slug: true,
            status: true,
            createdAt: true,
        },
    });

    return {
        id: created.id,
        slug: created.slug,
        status: toWireHelpArticleStatus(created.status),
        createdAt: created.createdAt.toISOString(),
    };
};

const updateArticle = async (
    actorUserId: string,
    articleId: string,
    body: UpdateArticleBody,
): Promise<IUpdateArticleResult> => {
    await requireSupportAgent(actorUserId);

    const existing = await prisma.helpArticle.findUnique({
        where: { id: articleId },
        select: {
            id: true,
            title: true,
            excerpt: true,
            body: true,
            category: true,
            status: true,
        },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Article not found.");
    }

    const nextTitle = body.title ?? existing.title;
    const nextExcerpt =
        body.excerpt === undefined
            ? existing.excerpt
            : body.excerpt === null
                ? null
                : body.excerpt;
    const nextBody = body.body ?? existing.body;
    const nextCategory = body.category ?? existing.category;
    const bodyChanged = body.body !== undefined && body.body !== existing.body;

    const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.helpArticle.update({
            where: { id: articleId },
            data: {
                title: nextTitle,
                excerpt: nextExcerpt,
                body: nextBody,
                category: nextCategory,
                searchTokens: buildSearchTokens(nextTitle, nextExcerpt, nextCategory),
            },
            select: {
                id: true,
                status: true,
                updatedAt: true,
            },
        });

        if (bodyChanged) {
            // Compute the next version so we don't violate the (articleId, version)
            // unique constraint.
            const last = await tx.contentRevision.findFirst({
                where: { articleId },
                orderBy: { version: "desc" },
                select: { version: true },
            });
            const nextVersion = (last?.version ?? 0) + 1;
            await tx.contentRevision.create({
                data: {
                    articleId,
                    authorId: actorUserId,
                    version: nextVersion,
                    title: nextTitle,
                    excerpt: nextExcerpt,
                    body: nextBody,
                    changeNote: body.changeNote ?? null,
                },
            });
        }

        return row;
    });

    await recordAuditEvent({
        actorId: actorUserId,
        kind: bodyChanged ? "ARTICLE_REVISED" : "STATUS_CHANGED",
        targetRef: `article:${articleId}`,
        metadata: { title: nextTitle, category: nextCategory },
    });

    return {
        id: updated.id,
        version: bodyChanged ? 1 : 0,
        updatedAt: updated.updatedAt.toISOString(),
        status: toWireHelpArticleStatus(updated.status),
    };
};

const changeArticleStatus = async (
    actorUserId: string,
    articleId: string,
    body: ChangeArticleStatusBody,
): Promise<IChangeStatusResult> => {
    await requireSupportAgent(actorUserId);

    const existing = await prisma.helpArticle.findUnique({
        where: { id: articleId },
        select: { id: true, status: true, publishedAt: true },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Article not found.");
    }

    const nextDb = toHelpArticleStatusDb(body.status);
    const shouldStampPublished =
        nextDb === HelpArticleStatus.PUBLISHED && existing.publishedAt == null;

    const updated = await prisma.helpArticle.update({
        where: { id: articleId },
        data: {
            status: nextDb,
            publishedAt: shouldStampPublished
                ? new Date()
                : existing.publishedAt,
        },
        select: {
            id: true,
            status: true,
            publishedAt: true,
            updatedAt: true,
        },
    });

    await recordAuditEvent({
        actorId: actorUserId,
        kind:
            nextDb === HelpArticleStatus.PUBLISHED
                ? "ARTICLE_PUBLISHED"
                : "STATUS_CHANGED",
        targetRef: `article:${articleId}`,
        metadata: {
            from: existing.status,
            to: nextDb,
            note: body.note ?? null,
        },
    });

    return {
        id: updated.id,
        status: toWireHelpArticleStatus(updated.status),
        publishedAt: toIso(updated.publishedAt),
        updatedAt: updated.updatedAt.toISOString(),
    };
};

const archiveArticle = async (
    actorUserId: string,
    articleId: string,
    reason: string | undefined,
): Promise<IArchiveArticleResult> => {
    await requireSupportAgent(actorUserId);

    const existing = await prisma.helpArticle.findUnique({
        where: { id: articleId },
        select: { id: true, status: true },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Article not found.");
    }

    const now = new Date();
    const updated = await prisma.helpArticle.update({
        where: { id: articleId },
        data: { status: HelpArticleStatus.ARCHIVED },
        select: { id: true, status: true },
    });

    await recordAuditEvent({
        actorId: actorUserId,
        kind: "STATUS_CHANGED",
        targetRef: `article:${articleId}`,
        metadata: {
            from: existing.status,
            to: "ARCHIVED",
            reason: reason ?? null,
        },
    });

    return {
        id: updated.id,
        status: toWireHelpArticleStatus(updated.status),
        archivedAt: now.toISOString(),
    };
};

const replyFeedback = async (
    actorUserId: string,
    articleId: string,
    feedbackId: string,
    reply: string,
): Promise<IReplyFeedbackResult> => {
    await requireSupportAgent(actorUserId);

    const feedback = await prisma.knowledgeFeedback.findFirst({
        where: { id: feedbackId, articleId },
        select: { id: true, comment: true, createdAt: true },
    });

    if (!feedback) {
        throw new AppError(status.NOT_FOUND, "Feedback not found.");
    }

    // We bake the reply into the comment as `REPLY: ...` because the schema
    // doesn't currently have a dedicated `authorReply` column; the list view
    // parses this prefix back out for display.
    const stamped = `REPLY: ${reply}`;
    const updated = await prisma.knowledgeFeedback.update({
        where: { id: feedback.id },
        data: {
            comment: feedback.comment
                ? `${feedback.comment}\n\n${stamped}`
                : stamped,
        },
        select: { id: true, createdAt: true },
    });

    // Trace-only: enqueue a SupportJobRun so S7 reports surfaces agent replies
    // as an audit-trailable action. Best-effort.
    let jobRunStatus: IReplyFeedbackResult["jobRunStatus"] = null;
    try {
        const run = await prisma.supportJobRun.create({
            data: {
                kind: "knowledge.reply",
                status: "SUCCEEDED",
                requestedById: actorUserId,
                parameters: { feedbackId },
                finishedAt: new Date(),
            },
            select: { status: true },
        });
        jobRunStatus = run.status === "SUCCEEDED" ? "succeeded" : "queued";
    } catch {
        jobRunStatus = null;
    }

    return {
        feedbackId: updated.id,
        reply,
        repliedAt: updated.createdAt.toISOString(),
        jobRunStatus,
    };
};

export const knowledgeService = {
    listArticles,
    getArticle,
    createArticle,
    updateArticle,
    changeArticleStatus,
    archiveArticle,
    replyFeedback,
};