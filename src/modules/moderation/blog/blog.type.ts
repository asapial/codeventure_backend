/**
 * M3 — Blog Review wire types.
 *
 * Aligned to the real Prisma `BlogPost` model:
 *   postSlug (unique), title, authorName, wordCount, regions (string?),
 *   coverAsset? (FileAsset.secureUrl), status / riskLevel / version /
 *   lastDecisionKey / lastReasonCode / lastReasonNote / lastReviewedAt /
 *   lastReviewedById / submittedById / createdAt / updatedAt.
 */

import type {
    ModerationStatusWire as IModerationStatus,
    ModerationDecisionWire,
    ModerationReasonWire as IModerationReason,
    RiskLevelWire as IRiskLevel,
    IPagedResponse,
} from "../moderation.wire.types";

export interface IBlogPostRow {
    id: string;
    postSlug: string;
    title: string;
    authorName: string;
    wordCount: number;
    regions: string[];
    coverUrl: string | null;
    status: IModerationStatus;
    riskLevel: IRiskLevel;
    lastReasonCode: IModerationReason | null;
    lastReasonNote: string | null;
    submittedByName: string | null;
    submittedByEmail: string | null;
    submittedAt: string;
    lastReviewedAt: string | null;
    lastReviewedByName: string | null;
    lastReviewedByEmail: string | null;
    version: number;
}

export interface IBlogPostListResponse {
    items: IBlogPostRow[];
    page: number;
    pageSize: number;
    total: number;
}

export interface IBlogPostDetailResponse {
    id: string;
    postSlug: string;
    title: string;
    authorName: string;
    wordCount: number;
    regions: string[];
    coverUrl: string | null;
    status: IModerationStatus;
    riskLevel: IRiskLevel;
    lastReasonCode: IModerationReason | null;
    lastReasonNote: string | null;
    submittedBy: {
        id: string;
        name: string;
        email: string;
    } | null;
    submittedAt: string;
    lastReviewedAt: string | null;
    lastReviewedBy: {
        id: string;
        name: string;
        email: string;
    } | null;
    version: number;
    updatedAt: string;
}

export interface IBlogPostDecideResponse {
    id: string;
    status: IModerationStatus;
    version: number;
    reviewId: string;
    idempotentReplay: boolean;
}