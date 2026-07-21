/**
 * S7 — Support Reports service.
 *
 * Read-only rollups across `SupportTicket`, `EscalationEvent`,
 * `SupportAssignment`, `AuditLog`, `SupportJobRun`, `HelpArticle`, and
 * `KnowledgeFeedback`. Each public method is async + agent-guarded.
 *
 * Trend bucketing is JS-side (UTC `day` or ISO-week) because the schema
 * doesn't depend on a `date_trunc` extension.
 */

import { prisma, Prisma } from "../../../lib/prisma";
import {
    diffMinutes,
    requireSupportAgent,
    toIso,
    toWireJobRunStatus,
    toWireSlaSeverity,
    toWireTicketPriority,
    toWireTicketStatus,
} from "../support.policy";
import type {
    IAgentLeaderboardResponse,
    IAgentLeaderboardRow,
    IReportAuditRow,
    IReportEscalationRow,
    IReportJobRunRow,
    IReportKnowledgeRow,
    IReportsAuditResponse,
    IReportsEscalationsResponse,
    IReportsJobRunResponse,
    IReportsKpiResponse,
} from "./reports.type";
import type {
    AuditQuery,
    JobRunQuery,
    LeaderboardQuery,
    ReportsDateRange,
} from "./reports.validation";
import { AuditEventType, JobRunStatus } from "../../../../prisma/generated/prisma/enums";

// ── Helpers ─────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_DAYS = 30;

const resolveWindow = (
    query: ReportsDateRange | AuditQuery | LeaderboardQuery | undefined,
): { from: Date; to: Date; granularity: "day" | "week" } => {
    const to = query?.to ? new Date(query.to) : new Date();
    const from = query?.from
        ? new Date(query.from)
        : new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);
    const granularity =
        (query as ReportsDateRange | undefined)?.granularity ?? "day";
    return { from, to, granularity };
};

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

const isoWeek = (d: Date): string => {
    // ISO week: copy date, set to nearest Thursday, year + week number.
    const date = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
        ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const bucketKey = (d: Date, granularity: "day" | "week"): string =>
    granularity === "week" ? isoWeek(d) : isoDay(d);

const toDbJobRunStatus = (
    s: "queued" | "running" | "succeeded" | "failed" | "partial",
): JobRunStatus => {
    switch (s) {
        case "running":
            return JobRunStatus.RUNNING;
        case "succeeded":
            return JobRunStatus.SUCCEEDED;
        case "failed":
            return JobRunStatus.FAILED;
        case "partial":
            return JobRunStatus.PARTIAL;
        case "queued":
        default:
            return JobRunStatus.QUEUED;
    }
};

// ── Typed selects ──────────────────────────────────────────────────────

type EscalationRow = Prisma.EscalationEventGetPayload<{
    include: {
        ticket: { select: { ticketNumber: true; subject: true } };
        triggeredBy: { select: { id: true; fullName: true } };
    };
}>;

type AuditRow = Prisma.AuditLogGetPayload<{
    include: {
        actor: { select: { id: true; fullName: true } };
    };
}>;

type JobRunRow = Prisma.SupportJobRunGetPayload<{
    include: {
        requestedBy: { select: { id: true; fullName: true } };
    };
}>;

type AssignmentWithTicket = Prisma.SupportAssignmentGetPayload<{
    include: {
        agent: { select: { id: true; fullName: true } };
        ticket: {
            select: {
                id: true;
                resolvedAt: true;
                priority: true;
                status: true;
                createdAt: true;
            };
        };
    };
}>;

// ── KPI rollup ─────────────────────────────────────────────────────────

const getKpiRollup = async (
    actorUserId: string,
    query: ReportsDateRange,
): Promise<IReportsKpiResponse> => {
    await requireSupportAgent(actorUserId);
    const { from, to, granularity } = resolveWindow(query);

    const where: Prisma.SupportTicketWhereInput = {
        createdAt: { gte: from, lte: to },
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    };

    const [
        totalOpened,
        totalResolved,
        escalationsCurrent,
        reopenedFromAudit,
        byStatus,
        byPriority,
        trendRows,
        profileAgg,
    ] = await Promise.all([
        prisma.supportTicket.count({ where }),
        prisma.supportTicket.count({
            where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } },
        }),
        prisma.escalationEvent.count({
            where: { createdAt: { gte: from, lte: to } },
        }),
        prisma.auditLog.count({
            where: {
                kind: AuditEventType.TICKET_REOPENED,
                createdAt: { gte: from, lte: to },
            },
        }),
        prisma.supportTicket.groupBy({
            by: ["status"],
            where,
            _count: { _all: true },
        }),
        prisma.supportTicket.groupBy({
            by: ["priority"],
            where,
            _count: { _all: true },
        }),
        prisma.supportTicket.findMany({
            where,
            select: { createdAt: true, resolvedAt: true },
        }),
        // CSAT lives on OrganizationSupportProfile — average over orgs whose
        // profile was updated inside the window.
        prisma.organizationSupportProfile.aggregate({
            _avg: { csatScore: true },
            where: { updatedAt: { gte: from, lte: to } },
        }),
    ]);

    const csatAverage = profileAgg._avg.csatScore ?? null;
    const resolutionRate =
        totalOpened > 0 ? Math.round((totalResolved / totalOpened) * 1000) / 1000 : 0;

    const trendMap = new Map<
        string,
        { opened: number; resolved: number; escalated: number }
    >();
    for (const r of trendRows) {
        const k = bucketKey(r.createdAt, granularity);
        const acc = trendMap.get(k) ?? { opened: 0, resolved: 0, escalated: 0 };
        acc.opened += 1;
        if (r.resolvedAt) acc.resolved += 1;
        trendMap.set(k, acc);
    }

    const trend = Array.from(trendMap.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([bucket, v]) => ({
            bucket,
            opened: v.opened,
            resolved: v.resolved,
            escalated: v.escalated,
            csat: csatAverage,
        }));

    return {
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
        granularity,
        kpis: [
            { label: "Tickets opened", value: totalOpened, delta: null, unit: "count" },
            {
                label: "Tickets resolved",
                value: totalResolved,
                delta: null,
                unit: "count",
            },
            {
                label: "Resolution rate",
                value: Math.round(resolutionRate * 1000) / 10,
                delta: null,
                unit: "percent",
            },
            {
                label: "Escalations",
                value: escalationsCurrent,
                delta: null,
                unit: "count",
            },
            {
                label: "CSAT avg",
                value: csatAverage == null ? 0 : Math.round(csatAverage * 100) / 100,
                delta: null,
                unit: "score",
            },
            {
                label: "Reopened",
                value: reopenedFromAudit,
                delta: null,
                unit: "count",
            },
        ],
        statusBreakdown: byStatus.map((r) => ({
            status: toWireTicketStatus(r.status),
            count: r._count._all,
        })),
        priorityBreakdown: byPriority.map((r) => ({
            priority: toWireTicketPriority(r.priority),
            count: r._count._all,
        })),
        trend,
    };
};

// ── Escalations rollup ─────────────────────────────────────────────────

const listEscalations = async (
    actorUserId: string,
    query: ReportsDateRange,
): Promise<IReportsEscalationsResponse> => {
    await requireSupportAgent(actorUserId);
    const { from, to } = resolveWindow(query);

    const rows = await prisma.escalationEvent.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
            ticket: { select: { ticketNumber: true, subject: true } },
            triggeredBy: { select: { id: true, fullName: true } },
        },
    });

    const mapped: IReportEscalationRow[] = (rows as EscalationRow[]).map((r) => ({
        id: r.id,
        ticketId: r.ticketId,
        ticketNumber: r.ticket.ticketNumber,
        ticketSubject: r.ticket.subject,
        fromPriority: toWireTicketPriority(r.fromPriority),
        toPriority: toWireTicketPriority(r.toPriority),
        severity: toWireSlaSeverity(r.severity),
        reason: r.reason,
        agent: { id: r.triggeredBy.id, name: r.triggeredBy.fullName },
        createdAt: r.createdAt.toISOString(),
    }));

    return {
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
        total: mapped.length,
        rows: mapped,
    };
};

// ── Agent leaderboard ──────────────────────────────────────────────────

const getLeaderboard = async (
    actorUserId: string,
    query: LeaderboardQuery,
): Promise<IAgentLeaderboardResponse> => {
    await requireSupportAgent(actorUserId);
    const { from, to } = resolveWindow(query);

    const rows: AssignmentWithTicket[] = await prisma.supportAssignment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
            id: true,
            createdAt: true,
            ticketId: true,
            agentId: true,
            reason: true,
            assignedById: true,
            isCurrent: true,
            agent: { select: { id: true, fullName: true } },
            ticket: {
                select: {
                    id: true,
                    resolvedAt: true,
                    priority: true,
                    status: true,
                    createdAt: true,
                },
            },
        },
    });

    type Bucket = {
        agentId: string;
        name: string;
        handled: number;
        resolved: number;
        escalated: number;
        responseMins: number[];
        resolutionMins: number[];
    };

    const byAgent = new Map<string, Bucket>();
    for (const r of rows) {
        const b = byAgent.get(r.agentId) ?? {
            agentId: r.agentId,
            name: r.agent.fullName,
            handled: 0,
            resolved: 0,
            escalated: 0,
            responseMins: [],
            resolutionMins: [],
        };
        b.handled += 1;
        if (r.ticket.resolvedAt) b.resolved += 1;
        if (
            r.ticket.priority === "URGENT" ||
            r.ticket.priority === "HIGH"
        ) {
            b.escalated += 1;
        }
        // First-response proxy = assignment timestamp (the moment an agent
        // picks the ticket up). Schema has no dedicated firstRespondedAt
        // column; this matches how the inbox / dashboard compute it today.
        const fr = diffMinutes(r.ticket.createdAt, r.createdAt);
        if (fr != null) b.responseMins.push(fr);
        const rs = diffMinutes(r.ticket.createdAt, r.ticket.resolvedAt ?? undefined);
        if (rs != null) b.resolutionMins.push(rs);
        byAgent.set(r.agentId, b);
    }

    const avg = (xs: number[]): number | null => {
        if (xs.length === 0) return null;
        const s = xs.reduce((a, b) => a + b, 0);
        return Math.round((s / xs.length) * 10) / 10;
    };

    const out: IAgentLeaderboardRow[] = Array.from(byAgent.values())
        .sort((a, b) => b.handled - a.handled)
        .slice(0, query.limit)
        .map((b) => ({
            agentId: b.agentId,
            agentName: b.name,
            ticketsHandled: b.handled,
            ticketsResolved: b.resolved,
            ticketsEscalated: b.escalated,
            avgFirstResponseMin: avg(b.responseMins),
            avgResolutionMin: avg(b.resolutionMins),
            csatScore: null, // per-agent CSAT deferred to nightly rollup
        }));

    return {
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
        rows: out,
    };
};

// ── Audit log ──────────────────────────────────────────────────────────

const getAuditLog = async (
    actorUserId: string,
    query: AuditQuery,
): Promise<IReportsAuditResponse> => {
    await requireSupportAgent(actorUserId);

    const where: Prisma.AuditLogWhereInput = {};
    if (query.from || query.to) {
        where.createdAt = {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
        };
    }
    if (query.actorId) where.actorId = query.actorId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.kind) {
        // Restrict to declared enum values to keep the typed where strict.
        const validKinds = Object.values(AuditEventType) as string[];
        if (validKinds.includes(query.kind)) {
            where.kind = query.kind as AuditEventType;
        } else {
            where.kind = AuditEventType.TICKET_CREATED; // dummy to match none
        }
    }

    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: query.pageSize,
            include: { actor: { select: { id: true, fullName: true } } },
        }),
        prisma.auditLog.count({ where }),
    ]);

    const items: IReportAuditRow[] = (rows as AuditRow[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        actor:
            r.actor == null
                ? { id: null, name: null }
                : { id: r.actor.id, name: r.actor.fullName },
        targetRef: r.targetRef,
        ticketId: r.ticketId,
        organizationId: r.organizationId,
        customerVisible: r.customerVisible,
        metadata: r.metadata as unknown,
        createdAt: r.createdAt.toISOString(),
    }));

    return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
};

// ── Job runs ────────────────────────────────────────────────────────────

const getJobRuns = async (
    actorUserId: string,
    query: JobRunQuery,
): Promise<IReportsJobRunResponse> => {
    await requireSupportAgent(actorUserId);

    const where: Prisma.SupportJobRunWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = toDbJobRunStatus(query.status);
    if (query.requestedById) where.requestedById = query.requestedById;

    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await prisma.$transaction([
        prisma.supportJobRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: query.pageSize,
            include: { requestedBy: { select: { id: true, fullName: true } } },
        }),
        prisma.supportJobRun.count({ where }),
    ]);

    const items: IReportJobRunRow[] = (rows as JobRunRow[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        status: toWireJobRunStatus(r.status),
        requestedBy:
            r.requestedBy == null
                ? { id: null, name: null }
                : { id: r.requestedBy.id, name: r.requestedBy.fullName },
        parameters: r.parameters as unknown,
        resultJson: r.resultJson as unknown,
        errorMessage: r.errorMessage,
        startedAt: toIso(r.startedAt),
        finishedAt: toIso(r.finishedAt),
        createdAt: r.createdAt.toISOString(),
    }));

    return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
};

// ── Knowledge feedback rollup ──────────────────────────────────────────

const getKnowledgeRollup = async (
    actorUserId: string,
): Promise<IReportKnowledgeRow[]> => {
    await requireSupportAgent(actorUserId);

    const { toWireHelpArticleStatus } = await import("../support.policy");

    const articles = await prisma.helpArticle.findMany({
        orderBy: [{ helpfulYes: "desc" }, { viewCount: "desc" }],
        take: 25,
        select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            viewCount: true,
            helpfulYes: true,
            helpfulNo: true,
            _count: { select: { feedback: true } },
        },
    });

    return articles.map((a) => ({
        articleId: a.id,
        slug: a.slug,
        title: a.title,
        status: toWireHelpArticleStatus(a.status),
        viewCount: a.viewCount,
        helpfulYes: a.helpfulYes,
        helpfulNo: a.helpfulNo,
        feedbackCount: a._count.feedback,
    }));
};

export const reportsService = {
    getKpiRollup,
    listEscalations,
    getLeaderboard,
    getAuditLog,
    getJobRuns,
    getKnowledgeRollup,
};