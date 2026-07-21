/**
 * S6 — Knowledge Base wire types.
 *
 * The article list returns summary rows, the article detail returns the
 * full body + revisions + feedback rollup + attachments, and the
 * create/update/reply mutations return their respective envelope.
 */

import type { HelpArticleStatusWire, JobRunStatusWire } from "../support.wire.types";

// ── Article list ─────────────────────────────────────────────────────────

export interface IKnowledgeArticleSummary {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    category: string;
    status: HelpArticleStatusWire;
    authorId: string | null;
    authorName: string | null;
    viewCount: number;
    helpfulYes: number;
    helpfulNo: number;
    helpfulRate: number | null;
    publishedAt: string | null;
    updatedAt: string;
    createdAt: string;
}

export interface IKnowledgeListResponse {
    items: IKnowledgeArticleSummary[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

// ── Article detail ───────────────────────────────────────────────────────

export interface IKnowledgeArticleAuthor {
    id: string;
    name: string;
    avatarUrl: string | null;
}

export interface IKnowledgeRevisionRow {
    id: string;
    version: number;
    title: string;
    excerpt: string | null;
    changeNote: string | null;
    author: { id: string; name: string };
    createdAt: string;
}

export interface IKnowledgeFeedbackRow {
    id: string;
    wasHelpful: boolean;
    comment: string | null;
    user: { id: string; name: string } | null;
    authorReply: string | null;
    createdAt: string;
}

export interface IKnowledgeAttachmentRow {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    altText: string | null;
    uploader: { id: string; name: string };
    createdAt: string;
}

export interface IKnowledgeFeedbackSummary {
    totalYes: number;
    totalNo: number;
    helpfulRate: number | null;
    recent: IKnowledgeFeedbackRow[];
}

export interface IKnowledgeArticleDetail {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    category: string;
    status: HelpArticleStatusWire;
    author: IKnowledgeArticleAuthor | null;
    viewCount: number;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    revisions: IKnowledgeRevisionRow[];
    feedback: IKnowledgeFeedbackSummary;
    attachments: IKnowledgeAttachmentRow[];
}

// ── Mutation results ─────────────────────────────────────────────────────

export interface ICreateArticleResult {
    id: string;
    slug: string;
    status: HelpArticleStatusWire;
    createdAt: string;
}

export interface IUpdateArticleResult {
    id: string;
    version: number;
    updatedAt: string;
    status: HelpArticleStatusWire;
}

export interface IChangeStatusResult {
    id: string;
    status: HelpArticleStatusWire;
    publishedAt: string | null;
    updatedAt: string;
}

export interface IArchiveArticleResult {
    id: string;
    status: HelpArticleStatusWire;
    archivedAt: string;
}

export interface IReplyFeedbackResult {
    feedbackId: string;
    reply: string;
    repliedAt: string;
    jobRunStatus: JobRunStatusWire | null;
}