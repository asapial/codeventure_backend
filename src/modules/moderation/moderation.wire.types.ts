/**
 * Wire-format type aliases shared across the moderation module's
 * response payloads. These mirror the helpers in `moderation.policy.ts`
 * so the frontend can map them through a single file.
 */

export type ModerationStatusWire =
    | "queued"
    | "in-review"
    | "decided"
    | "escalated"
    | "closed";

export type ModerationDecisionWire =
    | "approved"
    | "changes-requested"
    | "blocked"
    | "escalated";

export type ModerationReasonWire =
    | "quality"
    | "accuracy"
    | "brand-voice"
    | "copyright"
    | "privacy-pii"
    | "sensitive-topic"
    | "spam-promotional"
    | "off-topic"
    | "outdated"
    | "legal-disclosure-missing"
    | "testimonial-consent-missing"
    | "media-infected"
    | "media-prohibited"
    | "accessibility"
    | "other";

export type RiskLevelWire = "low" | "medium" | "high" | "critical";

export type ContentTypeWire =
    | "blog-post"
    | "portfolio-case-study"
    | "testimonial"
    | "media-asset"
    | "client-publication";

export type ClientDisplayScopeWire =
    | "internal-only"
    | "password-protected"
    | "public-reference"
    | "public-featured";

export type TestimonialConsentScopeWire =
    | "not-granted"
    | "internal-reference-only"
    | "public-reference"
    | "public-featured"
    | "public-with-name-and-photo"
    | "public-paid-case-study";

export type MediaScanStatusWire =
    | "pending"
    | "clean"
    | "infected"
    | "prohibited-content"
    | "scan-failed";

export type MediaVisibilityWire =
    | "private"
    | "internal-team"
    | "public-reference"
    | "public-featured";

export interface IPagedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}

export interface IModerationActorRef {
    id: string;
    name: string | null;
    email: string;
}

/**
 * A standardised actor reference for cases. Returned by every list/detail
 * endpoint so the frontend doesn't have to thread `reviewer: {name,email}`
 * through its render code.
 */
export interface IModerationActorLite {
    id: string;
    name: string | null;
    email: string;
}