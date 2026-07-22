/**
 * M1 — Moderator Dashboard
 *
 * One read endpoint returns everything the M1 page renders:
 *   - kpis                 : top-line counters per moderation surface
 *   - queueByContentType   : how much is queued on each surface
 *   - myRecentDecisions    : last 8 decisions by the current moderator
 *   - recentAudit          : last 12 cross-team moderation events
 *   - topReasons           : top 5 reasons cited on recent decisions
 *   - riskDistribution     : counts by risk level across all open surfaces
 */

import type {
    ModerationStatusWire,
    ModerationDecisionWire,
    ModerationReasonWire,
    ContentTypeWire,
    RiskLevelWire,
} from "../moderation.wire.types";

export interface IModeratorDashboardKpis {
    totalQueued: number;
    totalInReview: number;
    totalDecidedLast24h: number;
    totalEscalated: number;
    highRiskOpen: number;
    criticalRiskOpen: number;
    blogQueued: number;
    portfolioQueued: number;
    testimonialsQueued: number;
    mediaQueued: number;
    clientPublicationsQueued: number;
    meDecidedLast24h: number;
    meOpenAssignments: number;
}

export interface IQueueByContentTypeRow {
    contentType: ContentTypeWire;
    status: ModerationStatusWire;
    count: number;
}

export interface IRecentDecisionRow {
    reviewId: string;
    contentType: ContentTypeWire;
    contentTitle: string;
    decision: ModerationDecisionWire;
    reasonCode: ModerationReasonWire | null;
    reviewerName: string | null;
    reviewerEmail: string | null;
    decidedAt: string;
}

export interface IRecentAuditRow {
    id: string;
    kind: string;
    actorName: string | null;
    actorEmail: string | null;
    targetRef: string;
    contentType: ContentTypeWire | null;
    summary: string;
    createdAt: string;
}

export interface ITopReasonRow {
    reasonCode: ModerationReasonWire;
    count: number;
}

export interface IRiskDistributionRow {
    riskLevel: RiskLevelWire;
    count: number;
}

export interface IModeratorDashboard {
    generatedAt: string;
    kpis: IModeratorDashboardKpis;
    queueByContentType: IQueueByContentTypeRow[];
    myRecentDecisions: IRecentDecisionRow[];
    recentAudit: IRecentAuditRow[];
    topReasons: ITopReasonRow[];
    riskDistribution: IRiskDistributionRow[];
}