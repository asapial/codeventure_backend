/**
 * M7 — Moderation audit timeline wire types.
 *
 * Read-only view over `AuditLog` rows that originated from any of the
 * 9 moderation `AuditEventType` kinds (CONTENT_APPROVED … CLIENT_PUBLICATION_REVOKED).
 * Exposes the actor (when still present), the targetRef, and a denormalised
 * summary string for the timeline UI.
 */

import type { ContentTypeWire } from "../moderation.wire.types";

export type ModerationAuditKind =
    | "CONTENT_APPROVED"
    | "CONTENT_BLOCKED"
    | "CONTENT_CHANGES_REQUESTED"
    | "CONTENT_ESCALATED"
    | "MEDIA_QUARANTINED"
    | "MEDIA_CLEARED"
    | "TESTIMONIAL_CONSENT_VERIFIED"
    | "CLIENT_PUBLICATION_APPROVED"
    | "CLIENT_PUBLICATION_REVOKED";

export interface IAuditTimelineRow {
    id: string;
    kind: ModerationAuditKind;
    targetRef: string;
    contentType: ContentTypeWire | null;
    actorName: string | null;
    actorEmail: string | null;
    summary: string;
    metadata: unknown;
    customerVisible: boolean;
    createdAt: string;
}

export interface IAuditTimelineListResponse {
    items: IAuditTimelineRow[];
    page: number;
    pageSize: number;
    total: number;
}

export interface IAuditTimelineKinds {
    total: number;
    byKind: Array<{ kind: ModerationAuditKind; count: number }>;
}