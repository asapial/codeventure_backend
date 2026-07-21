/**
 * S6 — Knowledge Base Zod schemas.
 *
 * Validates query-string filters for the article list, the article id
 * param, and the create / update / status-change / archive / reply
 * payloads used by the knowledge console endpoints.
 */

import { z } from "zod";

/** Wire enum mirrors `HelpArticleStatus`. */
export const helpArticleStatusEnum = z.enum([
    "draft",
    "in-review",
    "published",
    "archived",
]);

/** Wire helper for response envelopes. */
export const articleCategoryEnum = z
    .string()
    .min(1)
    .max(48)
    .optional();

/**
 * GET /api/v1/support/knowledge
 *
 * Filterable by `q`, `status`, `category`, `authorId`, with paged sort.
 */
export const knowledgeListQuerySchema = z.object({
    q: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .optional(),
    status: helpArticleStatusEnum.optional(),
    category: z
        .string()
        .trim()
        .min(1)
        .max(48)
        .optional(),
    authorId: z
        .string()
        .uuid()
        .optional(),
    sort: z
        .enum(["updated-desc", "updated-asc", "title-asc", "published-desc"])
        .default("updated-desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type KnowledgeListQuery = z.infer<typeof knowledgeListQuerySchema>;

/**
 * GET /api/v1/support/knowledge/:id
 */
export const articleIdParamSchema = z.object({
    id: z.string().uuid(),
});

/**
 * POST /api/v1/support/knowledge
 * Author drafts a new article.
 */
export const createArticleBodySchema = z.object({
    title: z.string().trim().min(3).max(180),
    excerpt: z.string().trim().max(280).optional(),
    body: z.string().trim().min(1).max(50_000),
    category: z.string().trim().min(1).max(48),
});

export type CreateArticleBody = z.infer<typeof createArticleBodySchema>;

/**
 * PATCH /api/v1/support/knowledge/:id
 * Updates body / title / excerpt / category. Always creates a new
 * `ContentRevision` row when the body actually changes.
 */
export const updateArticleBodySchema = z
    .object({
        title: z.string().trim().min(3).max(180).optional(),
        excerpt: z.string().trim().max(280).nullable().optional(),
        body: z.string().trim().min(1).max(50_000).optional(),
        category: z.string().trim().min(1).max(48).optional(),
        changeNote: z.string().trim().max(280).optional(),
    })
    .refine(
        (v) =>
            v.title !== undefined ||
            v.excerpt !== undefined ||
            v.body !== undefined ||
            v.category !== undefined,
        { message: "At least one field must be provided." },
    );

export type UpdateArticleBody = z.infer<typeof updateArticleBodySchema>;

/**
 * PATCH /api/v1/support/knowledge/:id/status
 * Transitions an article between draft → in-review → published → archived.
 */
export const changeArticleStatusBodySchema = z.object({
    status: helpArticleStatusEnum,
    note: z.string().trim().max(280).optional(),
});

export type ChangeArticleStatusBody = z.infer<
    typeof changeArticleStatusBodySchema
>;

/**
 * POST /api/v1/support/knowledge/:id/archive
 * No body required — included for symmetry / future expansion.
 */
export const archiveArticleBodySchema = z
    .object({
        reason: z.string().trim().max(280).optional(),
    })
    .optional();

export type ArchiveArticleBody = z.infer<typeof archiveArticleBodySchema>;

/**
 * POST /api/v1/support/knowledge/:id/reply
 * Author-side reply to a piece of `KnowledgeFeedback`.
 */
export const replyFeedbackBodySchema = z.object({
    feedbackId: z.string().uuid(),
    reply: z.string().trim().min(1).max(1_000),
});

export type ReplyFeedbackBody = z.infer<typeof replyFeedbackBodySchema>;