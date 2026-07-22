/**
 * M4 — Portfolio Case Study Review wire types.
 *
 * Aligned to the real Prisma `PortfolioCaseStudy` + `ClientPublicationApproval`:
 *   caseSlug (unique), title, clientName, industry, tags (string),
 *   heroAsset?.secureUrl, status / riskLevel / consentScope /
 *   consentMissing / lastDecisionKey / lastReasonCode / lastReasonNote /
 *   lastReviewedAt / lastReviewedById / submittedById / createdAt / updatedAt.
 *
 * `clientApprovals[]` is a list (case studies can have multiple consent
 * records over time); each entry carries approvedScope / clientName /
 * approvedAt / expiresAt / signedDocumentUrl.
 */

import type {
    ModerationStatusWire as IModerationStatus,
    ModerationReasonWire as IModerationReason,
    RiskLevelWire as IRiskLevel,
    ClientDisplayScopeWire as IClientDisplayScope,
    IPagedResponse,
} from "../moderation.wire.types";

export interface IClientApprovalSummary {
    id: string;
    approvedScope: IClientDisplayScope;
    clientName: string;
    approvedAt: string;
    expiresAt: string | null;
    signedDocumentUrl: string | null;
}

export interface IPortfolioCaseRow {
    id: string;
    caseSlug: string;
    title: string;
    clientName: string;
    industry: string | null;
    tags: string[];
    heroUrl: string | null;
    status: IModerationStatus;
    riskLevel: IRiskLevel;
    consentScope: IClientDisplayScope;
    consentMissing: boolean;
    lastReasonCode: IModerationReason | null;
    lastReasonNote: string | null;
    submittedByName: string | null;
    submittedByEmail: string | null;
    submittedAt: string;
    lastReviewedAt: string | null;
    lastReviewedByName: string | null;
    lastReviewedByEmail: string | null;
    latestApproval: IClientApprovalSummary | null;
    version: number;
}

export interface IPortfolioCaseListResponse
    extends IPagedResponse<IPortfolioCaseRow> {}

export interface IPortfolioCaseDetailResponse {
    id: string;
    caseSlug: string;
    title: string;
    clientName: string;
    industry: string | null;
    tags: string[];
    heroUrl: string | null;
    status: IModerationStatus;
    riskLevel: IRiskLevel;
    consentScope: IClientDisplayScope;
    consentMissing: boolean;
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
    clientApprovals: IClientApprovalSummary[];
    version: number;
    updatedAt: string;
}

export interface IPortfolioCaseDecideResponse {
    id: string;
    status: IModerationStatus;
    version: number;
    reviewId: string;
    idempotentReplay: boolean;
}