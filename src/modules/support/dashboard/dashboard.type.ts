/**
 * S1 — Customer Support Dashboard
 *
 * One read endpoint returns everything the S1 page renders:
 *   - kpis             : top-line counters (open, escalated, breached, etc.)
 *   - queue            : tickets awaiting the current agent
 *   - recentActivity   : last 12 cross-team actions (audit log feed)
 *   - escalations      : tickets currently in escalation radar
 *   - riskCustomers    : top at-risk customer orgs (5 worst)
 */

import type {
    TicketStatusWire,
    TicketPriorityWire,
    AccountStatusWire,
    SentimentWire,
    SlaSeverityWire,
} from "../support.wire.types";

export interface IDashboardKpis {
    openTickets: number;
    awaitingCustomer: number;
    awaitingAgent: number;
    escalated: number;
    slaBreached: number;
    slaWarning: number;
    resolvedToday: number;
    reopenedToday: number;
    newToday: number;
    unassigned: number;
    knowledgeArticlesPublished: number;
    knowledgeFeedbackYesLast7d: number;
}

export interface IAgentQueueRow {
    ticketId: string;
    ticketNumber: string;
    subject: string;
    organizationName: string;
    organizationId: string;
    priority: TicketPriorityWire;
    status: TicketStatusWire;
    sentiment: SentimentWire;
    firstResponseState: "satisfied" | "on-track" | "warning" | "breached";
    resolutionState: "satisfied" | "on-track" | "warning" | "breached";
    minutesSinceOpen: number;
    requesterName: string | null;
    updatedAt: string;
}

export interface IRecentActivityRow {
    id: string;
    kind: string;
    actorName: string | null;
    actorEmail: string | null;
    ticketId: string | null;
    ticketNumber: string | null;
    organizationName: string | null;
    summary: string;
    createdAt: string;
}

export interface IEscalationRow {
    ticketId: string;
    ticketNumber: string;
    subject: string;
    severity: SlaSeverityWire;
    minutesSinceOpen: number;
    minutesToDue: number | null;
    priority: TicketPriorityWire;
    organizationName: string;
    assignedAgent: string | null;
    escalatedAt: string;
    reason: string;
}

export interface IRiskCustomerRow {
    organizationId: string;
    organizationName: string;
    accountStatus: AccountStatusWire;
    healthScore: number;
    healthBand: "healthy" | "watch" | "at-risk" | "critical";
    openTicketCount: number;
    awaitingCustomerCount: number;
    overdueInvoiceCount: number;
    csatScore: number | null;
    churnRisk: boolean;
    factors: { label: string; penalty: number }[];
}

export interface ISupportDashboard {
    generatedAt: string;
    kpis: IDashboardKpis;
    queue: IAgentQueueRow[];
    recentActivity: IRecentActivityRow[];
    escalations: IEscalationRow[];
    riskCustomers: IRiskCustomerRow[];
}