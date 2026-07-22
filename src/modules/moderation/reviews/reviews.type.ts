/**
 * M2 — Unified Review Queue wire types.
 *
 * The queue is a UNION of four surface tables:
 *   - BlogPost
 *   - PortfolioCaseStudy
 *   - Testimonial
 *   - MalwareScan (media)
 *
 * `IReviewQueueRow` is a discriminated union over `kind`. Each branch
 * carries the surface-specific fields the moderator needs to triage
 * without round-tripping to the detail page.
 *
 * `decideReview` (write side) writes to the matching surface table and
 * appends a `ModerationReview` row in a single transaction.
 */

import type {
    ModerationStatusWire as IModerationStatus,
    RiskLevelWire as IRiskLevel,
    ModerationReasonWire as IModerationReason,
    ClientDisplayScopeWire as IClientDisplayScope,
    TestimonialConsentScopeWire as ITestimonialConsentScope,
    MediaScanStatusWire as IMediaScanStatus,
    IPagedResponse,
} from "../moderation.wire.types";

interface IReviewQueueRowBase {
    status: IModerationStatus;
    riskLevel: IRiskLevel;
    lastReasonCode: IModerationReason | null;
    lastReasonNote: string | null;
    lastReviewedAt: string | null;
    lastReviewedByName: string | null;
    lastReviewedByEmail: string | null;
    submittedByName: string | null;
    submittedAt: string;
    version: number;
}

export interface IBlogPostQueueRow extends IReviewQueueRowBase {
    kind: "BLOG_POST";
    id: string;
    postSlug: string;
    title: string;
    authorName: string;
    wordCount: number;
    coverUrl: string | null;
}

export interface IPortfolioCaseQueueRow extends IReviewQueueRowBase {
    kind: "PORTFOLIO_CASE_STUDY";
    id: string;
    caseSlug: string;
    title: string;
    clientName: string;
    heroUrl: string | null;
    consentScope: IClientDisplayScope;
    consentMissing: boolean;
}

export interface ITestimonialQueueRow extends IReviewQueueRowBase {
    kind: "TESTIMONIAL";
    id: string;
    handle: string;
    customerName: string;
    customerCompany: string | null;
    rating: number;
    bodyPreview: string;
    avatarUrl: string | null;
    consentScope: ITestimonialConsentScope;
    consentVerified: boolean;
}

export interface IMediaQueueRow extends IReviewQueueRowBase {
    kind: "MEDIA";
    id: string;
    fileAssetId: string;
    secureUrl: string;
    mimeType: string;
    bytes: number;
    scanStatus: IMediaScanStatus;
    fileUsageCount: number;
    targetRef: string;
}

export type IReviewQueueRow =
    | IBlogPostQueueRow
    | IPortfolioCaseQueueRow
    | ITestimonialQueueRow
    | IMediaQueueRow;

export interface IReviewQueueListResponse
    extends IPagedResponse<IReviewQueueRow> {
    counts: {
        blogPost: number;
        portfolioCase: number;
        testimonial: number;
        media: number;
    };
}

export interface IReviewDecideResponse {
    kind:
        | "BLOG_POST"
        | "PORTFOLIO_CASE_STUDY"
        | "TESTIMONIAL"
        | "MEDIA";
    id: string;
    status: IModerationStatus;
    version: number;
    reviewId: string;
    idempotentReplay: boolean;
}

/**
 * Cross-surface detail response. Discriminated union over `kind`, so the
 * client can switch on the union tag and pull surface-specific fields.
 */
interface IReviewDetailBase {
    status: IModerationStatus;
    riskLevel: IRiskLevel;
    lastReasonCode: IModerationReason | null;
    lastReasonNote: string | null;
    lastReviewedAt: string | null;
    lastReviewedByName: string | null;
    lastReviewedByEmail: string | null;
    submittedByName: string | null;
    submittedByEmail: string | null;
    submittedAt: string;
    updatedAt: string;
    version: number;
}

export interface IBlogPostDetailResponse extends IReviewDetailBase {
    kind: "BLOG_POST";
    id: string;
    title: string;
    postSlug: string;
    authorName: string;
    coverUrl: string | null;
}

export interface IPortfolioCaseDetailResponse extends IReviewDetailBase {
    kind: "PORTFOLIO_CASE_STUDY";
    id: string;
    title: string;
    caseSlug: string;
    clientName: string;
    heroUrl: string | null;
    consentScope: IClientDisplayScope;
    consentMissing: boolean;
}

export interface ITestimonialDetailResponse extends IReviewDetailBase {
    kind: "TESTIMONIAL";
    id: string;
    title: string;
    handle: string;
    customerName: string;
    customerCompany: string | null;
    customerRole: string | null;
    rating: number;
    bodyPreview: string;
    countryCode: string | null;
    avatarUrl: string | null;
    consentScope: ITestimonialConsentScope;
    consentVerified: boolean;
}

export interface IMediaDetailResponse extends IReviewDetailBase {
    kind: "MEDIA";
    id: string;
    title: string;
    fileAssetId: string;
    secureUrl: string;
    mimeType: string;
    bytes: number;
    scanStatus: IMediaScanStatus;
    targetRef: string;
}

export type IReviewDetailResponse =
    | IBlogPostDetailResponse
    | IPortfolioCaseDetailResponse
    | ITestimonialDetailResponse
    | IMediaDetailResponse;