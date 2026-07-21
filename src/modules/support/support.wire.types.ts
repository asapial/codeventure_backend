/**
 * Wire-format type aliases shared across the support module's response
 * payloads. These mirror the helpers in `support.policy.ts` so the
 * frontend can map them through a single file.
 */

export type TicketStatusWire =
    | "open"
    | "pending"
    | "on-hold"
    | "resolved"
    | "closed";

export type TicketPriorityWire =
    | "low"
    | "normal"
    | "high"
    | "urgent";

export type AccountStatusWire =
    | "active"
    | "at-risk"
    | "churning"
    | "dormant"
    | "closed";

export type SentimentWire =
    | "positive"
    | "neutral"
    | "negative"
    | "at-risk";

export type SlaSeverityWire =
    | "low"
    | "normal"
    | "high"
    | "critical";

export type ResolutionCodeWire =
    | "fixed"
    | "workaround"
    | "duplicate"
    | "wont-fix"
    | "customer-responded"
    | "escalated-to-engineering"
    | "billing-adjustment"
    | "other";

export type HelpArticleStatusWire =
    | "draft"
    | "in-review"
    | "published"
    | "archived";

export type NoteVisibilityWire =
    | "internal-team"
    | "leadership"
    | "private";

export type JobRunStatusWire =
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "partial";

export interface IPagedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}