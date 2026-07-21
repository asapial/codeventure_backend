/**
 * S7 — Support Reports wire types.
 *
 * Each tab on the reports UI maps to one envelope type below.
 */

import type {
    HelpArticleStatusWire,
    JobRunStatusWire,
    TicketPriorityWire,
    TicketStatusWire,
} from "../support.wire.types";

// ── KPI rollup ──────────────────────────────────────────────────────────

export interface IReportKpi {
    label: string;
    value: number;
    delta: number | null;
    unit: "count" | "minutes" | "percent" | "score";
}

export interface IReportStatusBucket {
    status: TicketStatusWire;
    count: number;
}

export interface IReportPriorityBucket {
    priority: TicketPriorityWire;
    count: number;
}

export interface IReportTrendPoint {
    bucket: string; // ISO date for "day", ISO week for "week"
    opened: number;
    resolved: number;
    escalated: number;
    csat: number | null;
}

export interface IReportsKpiResponse {
    windowStart: string;
    windowEnd: string;
    granularity: "day" | "week";
    kpis: IReportKpi[];
    statusBreakdown: IReportStatusBucket[];
    priorityBreakdown: IReportPriorityBucket[];
    trend: IReportTrendPoint[];
}

// ── Escalations rollup ─────────────────────────────────────────────────

export interface IReportEscalationRow {
    id: string;
    ticketId: string;
    ticketNumber: string;
    ticketSubject: string;
    fromPriority: TicketPriorityWire;
    toPriority: TicketPriorityWire;
    severity: "low" | "normal" | "high" | "critical";
    reason: string;
    agent: { id: string; name: string };
    createdAt: string;
}

export interface IReportsEscalationsResponse {
    windowStart: string;
    windowEnd: string;
    total: number;
    rows: IReportEscalationRow[];
}

// ── Agent leaderboard ──────────────────────────────────────────────────

export interface IAgentLeaderboardRow {
    agentId: string;
    agentName: string;
    ticketsHandled: number;
    ticketsResolved: number;
    ticketsEscalated: number;
    avgFirstResponseMin: number | null;
    avgResolutionMin: number | null;
    csatScore: number | null;
}

export interface IAgentLeaderboardResponse {
    windowStart: string;
    windowEnd: string;
    rows: IAgentLeaderboardRow[];
}

// ── Audit log ─────────────────────────────────────────────────────────

export interface IReportAuditRow {
    id: string;
    kind: string;
    actor: { id: string | null; name: string | null };
    targetRef: string;
    ticketId: string | null;
    organizationId: string | null;
    customerVisible: boolean;
    metadata: unknown;
    createdAt: string;
}

export interface IReportsAuditResponse {
    items: IReportAuditRow[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

// ── Job runs ───────────────────────────────────────────────────────────

export interface IReportJobRunRow {
    id: string;
    kind: string;
    status: JobRunStatusWire;
    requestedBy: { id: string | null; name: string | null };
    parameters: unknown;
    resultJson: unknown;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
}

export interface IReportsJobRunResponse {
    items: IReportJobRunRow[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

// ── Knowledge rollup (small helper row) ────────────────────────────────

export interface IReportKnowledgeRow {
    articleId: string;
    slug: string;
    title: string;
    status: HelpArticleStatusWire;
    viewCount: number;
    helpfulYes: number;
    helpfulNo: number;
    feedbackCount: number;
}