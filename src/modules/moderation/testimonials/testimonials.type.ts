/**
 * M5 — Testimonial Review
 *
 *   GET /api/v1/moderation/testimonials
 *   GET /api/v1/moderation/testimonials/:id
 *   POST /api/v1/moderation/testimonials/:id/decide
 *
 * The detail view joins the most recent `TestimonialConsent` row so a
 * moderator can confirm the author granted permission before approving
 * a public-featured testimonial. `consentVerified` is a denormalised
 * boolean on the row (set when scope != NOT_GRANTED), used as a cheap
 * filter chip on the list view.
 *
 * Field names mirror the Prisma `Testimonial` schema (customerName,
 * customerCompany, customerRole, body, handle) — NOT the legacy
 * `authorName/quote` pair.
 */

import type {
    ModerationStatusWire,
    ModerationDecisionWire,
    ModerationReasonWire,
    RiskLevelWire,
    TestimonialConsentScopeWire,
    IPagedResponse,
} from "../moderation.wire.types";

export interface ITestimonialRow {
    id: string;
    handle: string;
    customerName: string;
    customerCompany: string | null;
    customerRole: string | null;
    rating: number;
    bodyPreview: string;
    countryCode: string | null;
    avatarUrl: string | null;
    status: ModerationStatusWire;
    riskLevel: RiskLevelWire;
    lastReasonCode: ModerationReasonWire | null;
    lastReasonNote: string | null;
    submittedByName: string | null;
    submittedByEmail: string | null;
    submittedAt: string;
    lastReviewedAt: string | null;
    lastReviewedByName: string | null;
    lastReviewedByEmail: string | null;
    consentVerified: boolean;
    consentScope: TestimonialConsentScopeWire | null;
    version: number;
}

export interface ITestimonialListResponse
    extends IPagedResponse<ITestimonialRow> {}

export interface IConsentSummary {
    id: string;
    scope: TestimonialConsentScopeWire;
    verified: boolean;
    capturedAt: string;
    capturedByName: string | null;
    signedDocUrl: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}

export interface ITestimonialDetailResponse {
    id: string;
    handle: string;
    customerName: string;
    customerCompany: string | null;
    customerRole: string | null;
    rating: number;
    body: string;
    countryCode: string | null;
    avatarUrl: string | null;
    status: ModerationStatusWire;
    riskLevel: RiskLevelWire;
    consentScope: TestimonialConsentScopeWire;
    consentVerified: boolean;
    lastReasonCode: ModerationReasonWire | null;
    lastReasonNote: string | null;
    submittedBy: { id: string; name: string | null; email: string } | null;
    submittedAt: string;
    lastReviewedAt: string | null;
    lastReviewedBy: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    consent: IConsentSummary | null;
    version: number;
}

export interface ITestimonialDecideRequest {
    decision: ModerationDecisionWire;
    reasonCode: ModerationReasonWire | null;
    reasonNote: string | null;
    expectedVersion: number;
    idempotencyKey: string;
}

export interface ITestimonialDecideResponse {
    id: string;
    status: ModerationStatusWire;
    version: number;
    idempotentReplay: boolean;
    reviewId: string;
}