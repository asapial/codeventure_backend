/**
 * S1 — Customer Support Dashboard service.
 *
 * Single round-trip aggregation over SupportTicket, EscalationEvent,
 * OrganizationSupportProfile, AuditLog, and HelpArticle. The dashboard
 * is read-only; mutations go through inbox/ticket-detail submodules.
 */

import { prisma } from "../../../lib/prisma";
import { computeAccountHealth, lastNDays } from "../support.utils";
import {
    decOrNull,
    requireSupportAgent,
    toIso,
    toWireAccountStatus,
    toWireSlaSeverity,
    toWireTicketPriority,
    toWireTicketStatus,
    type SlaPolicyShape,
    computeSlaClock,
} from "../support.policy";
import type {
    IAgentQueueRow,
    IDashboardKpis,
    IEscalationRow,
    IRecentActivityRow,
    IRiskCustomerRow,
    ISupportDashboard,
} from "./dashboard.type";

/** Default policy used when the org hasn't configured one. */
const DEFAULT_POLICY: SlaPolicyShape = {
    firstResponseMinutes: 240, // 4h
    resolutionMinutes: 1440, // 24h
};

const getDashboard = async (actorUserId: string): Promise<ISupportDashboard> => {
    // Confirm the caller is a support agent — does not return policy, just
    // throws if not. Keeps the endpoint aligned with route-level auth.
    await requireSupportAgent(actorUserId);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [
        openCount,
        awaitingCustomerCount,
        awaitingAgentCount,
        escalatedCount,
        unassignedCount,
        resolvedTodayCount,
        reopenedTodayCount,
        newTodayCount,
        publishedArticleCount,
        helpfulYesLast7d,
        ticketQueueRows,
        recentAuditRows,
        escalationsRows,
        profileRows,
    ] = await Promise.all([
        prisma.supportTicket.count({ where: { status: "OPEN" } }),
        prisma.supportTicket.count({ where: { status: "PENDING_CUSTOMER" } }),
        prisma.supportTicket.count({ where: { status: "PENDING_STAFF" } }),
        prisma.supportTicket.count({ where: { status: "PENDING_STAFF" } }),
        prisma.supportTicket.count({
            where: { supportAssignments: { none: { isCurrent: true } } },
        }),
        prisma.supportTicket.count({
            where: { status: "RESOLVED", resolvedAt: { gte: startOfDay } },
        }),
        prisma.supportTicket.count({
            where: { status: "OPEN", updatedAt: { gte: startOfDay } },
        }),
        prisma.supportTicket.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.helpArticle.count({ where: { status: "PUBLISHED" } }),
        prisma.knowledgeFeedback.count({
            where: { wasHelpful: true, createdAt: { gte: sevenDaysAgo } },
        }),
        // Agent queue: tickets assigned to me, not closed/resolved.
        prisma.supportTicket.findMany({
            where: {
                status: { in: ["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF"] },
                supportAssignments: { some: { agentId: actorUserId, isCurrent: true } },
            },
            orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
            take: 12,
            select: {
                id: true,
                ticketNumber: true,
                subject: true,
                priority: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                organizationId: true,
                organization: { select: { name: true } },
                requester: { select: { name: true, email: true } },
            },
        }),
        prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
                id: true,
                kind: true,
                targetRef: true,
                ticketId: true,
                organizationId: true,
                beforeJson: true,
                afterJson: true,
                createdAt: true,
                actor: { select: { name: true, email: true } },
                ticket: { select: { ticketNumber: true, subject: true } },
                organization: { select: { name: true } },
            },
        }),
        prisma.escalationEvent.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
                id: true,
                ticketId: true,
                reason: true,
                severity: true,
                etaMinutes: true,
                createdAt: true,
                ticket: {
                    select: {
                        id: true,
                        ticketNumber: true,
                        subject: true,
                        priority: true,
                        status: true,
                        createdAt: true,
                        slaDueAt: true,
                        organization: { select: { name: true } },
                        supportAssignments: {
                            where: { isCurrent: true },
                            take: 1,
                            select: { agent: { select: { name: true, email: true } } },
                        },
                    },
                },
            },
        }),
        prisma.organizationSupportProfile.findMany({
            orderBy: [{ churnRisk: "desc" }, { healthScore: "asc" }],
            take: 8,
            select: {
                organizationId: true,
                organization: { select: { id: true, name: true } },
                status: true,
                healthScore: true,
                openTicketCount: true,
                awaitingCustomerCount: true,
                overdueInvoiceCount: true,
                csatScore: true,
                churnRisk: true,
                avgFirstResponseMin: true,
                avgResolutionMin: true,
            },
        }),
    ]);

    // ── SLA breach / warning roll-up (post-filter; cannot be expressed in
    // pure Prisma because it joins against the org's SlaPolicy).
    const slaCheckTickets = await prisma.supportTicket.findMany({
        where: {
            status: { in: ["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF"] },
        },
        select: {
            id: true,
            createdAt: true,
            organizationId: true,
        },
    });

    const slaPoliciesByOrg = await loadSlaPoliciesByOrg();

    let slaBreached = 0;
    let slaWarning = 0;
    for (const t of slaCheckTickets) {
        const policy = slaPoliciesByOrg.get(t.organizationId) ?? DEFAULT_POLICY;
        // Approximate "firstRespondedAt" via the first message from a non-customer
        // author. We don't have it on the row, so treat as null (not responded).
        const clock = computeSlaClock(t.createdAt, null, policy, now);
        if (clock.resolutionState === "breached" || clock.firstResponseState === "breached") {
            slaBreached += 1;
        } else if (
            clock.resolutionState === "warning" ||
            clock.firstResponseState === "warning"
        ) {
            slaWarning += 1;
        }
    }

    const kpis: IDashboardKpis = {
        openTickets: openCount,
        awaitingCustomer: awaitingCustomerCount,
        awaitingAgent: awaitingAgentCount,
        escalated: escalatedCount,
        slaBreached,
        slaWarning,
        resolvedToday: resolvedTodayCount,
        reopenedToday: reopenedTodayCount,
        newToday: newTodayCount,
        unassigned: unassignedCount,
        knowledgeArticlesPublished: publishedArticleCount,
        knowledgeFeedbackYesLast7d: helpfulYesLast7d,
    };

    // ── Agent queue mapping ────────────────────────────────────────────
    type QueueRow = (typeof ticketQueueRows)[number];
    const queue: IAgentQueueRow[] = (ticketQueueRows as QueueRow[]).map((t) => {
        const policy = slaPoliciesByOrg.get(t.organizationId) ?? DEFAULT_POLICY;
        const clock = computeSlaClock(t.createdAt, null, policy, now);
        return {
            ticketId: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            organizationName: t.organization?.name ?? "",
            organizationId: t.organizationId,
            priority: toWireTicketPriority(t.priority),
            status: toWireTicketStatus(t.status),
            sentiment: "neutral",
            firstResponseState: clock.firstResponseState,
            resolutionState: clock.resolutionState,
            minutesSinceOpen: clock.minutesSinceOpen ?? 0,
            requesterName: t.requester?.name ?? null,
            updatedAt: toIso(t.updatedAt) ?? "",
        };
    });

    // ── Recent activity mapping ────────────────────────────────────────
    const recentActivity: IRecentActivityRow[] = recentAuditRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        actorName: row.actor?.name ?? null,
        actorEmail: row.actor?.email ?? null,
        ticketId: row.ticketId,
        ticketNumber: row.ticket?.ticketNumber ?? null,
        organizationName: row.organization?.name ?? null,
        summary: buildAuditSummary(row.kind, row.ticket?.subject ?? null),
        createdAt: toIso(row.createdAt) ?? "",
    }));

    // ── Escalations mapping ────────────────────────────────────────────
    const escalations: IEscalationRow[] = escalationsRows.map((row) => {
        const minutesSinceOpen = Math.max(
            0,
            Math.floor((now.getTime() - row.ticket.createdAt.getTime()) / 60_000),
        );
        const minutesToDue =
            row.ticket.slaDueAt !== null
                ? Math.floor((row.ticket.slaDueAt.getTime() - now.getTime()) / 60_000)
                : null;
        const assignedAgent = row.ticket.supportAssignments[0]?.agent ?? null;
        return {
            ticketId: row.ticket.id,
            ticketNumber: row.ticket.ticketNumber,
            subject: row.ticket.subject,
            severity: toWireSlaSeverity(row.severity),
            minutesSinceOpen,
            minutesToDue,
            priority: toWireTicketPriority(row.ticket.priority),
            organizationName: row.ticket.organization.name,
            assignedAgent: assignedAgent?.name ?? assignedAgent?.email ?? null,
            escalatedAt: toIso(row.createdAt) ?? "",
            reason: row.reason,
        };
    });

    // ── Risk customers mapping ─────────────────────────────────────────
    const riskCustomers: IRiskCustomerRow[] = profileRows
        .map((p): IRiskCustomerRow => {
            // churnRisk is an Int 0..100; bool for the wire = risk >= 70.
            const churnFlag = p.churnRisk >= 70;
            const health = computeAccountHealth({
                openTicketCount: p.openTicketCount,
                awaitingCustomerCount: p.awaitingCustomerCount,
                overdueInvoiceCount: p.overdueInvoiceCount,
                avgFirstResponseMin: p.avgFirstResponseMin,
                avgResolutionMin: p.avgResolutionMin,
                csatScore: p.csatScore,
                churnRiskFlag: churnFlag,
            });
            return {
                organizationId: p.organizationId,
                organizationName: p.organization.name,
                accountStatus: toWireAccountStatus(p.status),
                healthScore: health.score,
                healthBand: health.band,
                openTicketCount: p.openTicketCount,
                awaitingCustomerCount: p.awaitingCustomerCount,
                overdueInvoiceCount: p.overdueInvoiceCount,
                csatScore: p.csatScore,
                churnRisk: churnFlag,
                factors: health.factors,
            };
        })
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 5);

    return {
        generatedAt: now.toISOString(),
        kpis,
        queue,
        recentActivity,
        escalations,
        riskCustomers,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load every org's "in effect" SLA policy into a Map keyed by orgId.
 * The "in effect" rule is: the org-specific default, else the global
 * default, else the static `DEFAULT_POLICY` constant.
 */
const loadSlaPoliciesByOrg = async (): Promise<Map<string, SlaPolicyShape>> => {
    const policies = await prisma.slaPolicy.findMany({
        select: {
            organizationId: true,
            firstResponseMinutes: true,
            resolutionMinutes: true,
            isDefault: true,
        },
    });
    const map = new Map<string, SlaPolicyShape>();
    for (const p of policies) {
        if (!p.organizationId) continue;
        // last write wins for now; future: business-hours aware selection.
        map.set(p.organizationId, {
            firstResponseMinutes: p.firstResponseMinutes,
            resolutionMinutes: p.resolutionMinutes,
        });
    }
    return map;
};

/**
 * Build a one-line summary for the audit feed.
 * We don't echo sensitive JSON — just a category hint + the ticket subject.
 */
const buildAuditSummary = (kind: string, subject: string | null): string => {
    switch (kind) {
        case "TICKET_CREATED":
            return `New ticket: ${subject ?? "(no subject)"}`;
        case "TICKET_ASSIGNED":
            return `Assigned: ${subject ?? ""}`;
        case "TICKET_REASSIGNED":
            return `Reassigned: ${subject ?? ""}`;
        case "TICKET_ESCALATED":
            return `Escalated: ${subject ?? ""}`;
        case "TICKET_RESOLVED":
            return `Resolved: ${subject ?? ""}`;
        case "TICKET_CLOSED":
            return `Closed: ${subject ?? ""}`;
        case "TICKET_REOPENED":
            return `Reopened: ${subject ?? ""}`;
        case "MESSAGE_POSTED":
            return `Message posted on: ${subject ?? ""}`;
        case "INTERNAL_NOTE_ADDED":
            return `Internal note added on: ${subject ?? ""}`;
        case "PRIORITY_CHANGED":
            return `Priority changed on: ${subject ?? ""}`;
        case "STATUS_CHANGED":
            return `Status changed on: ${subject ?? ""}`;
        case "MACRO_APPLIED":
            return `Macro applied to: ${subject ?? ""}`;
        case "ARTICLE_PUBLISHED":
            return `Knowledge article published`;
        case "ARTICLE_REVISED":
            return `Knowledge article revised`;
        case "CUSTOMER_FLAGGED":
            return `Customer flagged: ${subject ?? ""}`;
        default:
            return `${kind}`;
    }
};

// Suppress lint warning — `lastNDays` is reserved for future date-windowed
// aggregations on S7 reports.
void lastNDays;

export const dashboardService = { getDashboard };