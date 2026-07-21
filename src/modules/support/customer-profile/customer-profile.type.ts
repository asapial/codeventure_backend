/**
 * S5 — Customer Profile wire types.
 *
 * The profile page is a three-pane read:
 *   1. health snapshot  (status, health, churn, CSAT, ticket counts)
 *   2. ticket timeline  (recent open + recent resolved)
 *   3. activity feed    (CustomerActivityLog rows for this org)
 */

export interface ICustomerProfileMember {
    id: string;
    userId: string;
    role: "owner" | "admin" | "editor" | "viewer";
    name: string | null;
    email: string;
    joinedAt: string;
    isPrimary: boolean;
}

export interface ICustomerTicketRow {
    id: string;
    ticketNumber: string;
    subject: string;
    status: "open" | "pending" | "on-hold" | "resolved" | "closed";
    priority: "low" | "normal" | "high" | "urgent";
    updatedAt: string;
    resolvedAt: string | null;
    requester: {
        id: string;
        name: string | null;
        email: string;
    };
}

export interface ICustomerActivityEntry {
    id: string;
    kind: string;
    title: string;
    description: string | null;
    href: string | null;
    actor: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    createdAt: string;
    metadata: unknown;
}

export interface ICustomerProfile {
    organization: {
        id: string;
        slug: string;
        name: string;
        createdAt: string;
        updatedAt: string;
    };
    status: "active" | "at-risk" | "churning" | "dormant" | "closed";
    healthScore: number;
    churnRisk: number;
    csatScore: number | null;
    avgFirstResponseMin: number | null;
    avgResolutionMin: number | null;
    counts: {
        open: number;
        awaitingCustomer: number;
        resolved: number;
        overdueInvoices: number;
        members: number;
    };
    lastTouchedBy: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    lastTouchedAt: string | null;
    members: ICustomerProfileMember[];
    recentTickets: ICustomerTicketRow[];
    activity: ICustomerActivityEntry[];
}

export interface IProfileFlagResult {
    organizationId: string;
    status: "active" | "at-risk" | "churning" | "dormant" | "closed";
    healthScore: number;
    churnRisk: number;
    lastTouchedAt: string;
    lastTouchedBy: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

export interface IProfileNoteResult {
    activity: ICustomerActivityEntry;
}