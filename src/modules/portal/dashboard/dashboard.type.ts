/**
 * Wire-shape returned by GET /customer/dashboard.
 * Mirrors the frontend's `CustomerDashboard` Zod schema.
 */

/** Recent activity event (project activity + system events). */
export interface IDashboardActivity {
    id: string;
    at: string; // ISO
    kind: "project" | "approval" | "billing" | "support" | "maintenance";
    title: string;
    description: string | null;
    href: string | null;
}

/** Next upcoming milestone across every project in the org. */
export interface INextMilestone {
    projectId: string;
    projectSlug: string;
    projectName: string;
    title: string;
    dueAt: string | null;
    phase: string;
}

/** Per-project summary tile. */
export interface IHealthRollup {
    projectId: string;
    slug: string;
    name: string;
    phase: string;
    health: "on-track" | "at-risk" | "blocked";
    progress: number | null; // 0..1
    nextMilestoneTitle: string | null;
    nextMilestoneDueAt: string | null;
}

/** Billing snapshot — same shape as legacy /account/summary. */
export interface IDashboardBilling {
    currency: string;
    outstanding: number;
    nextInvoiceAt: string | null;
    nextInvoiceAmount: number | null;
}

/** Maintenance subscription snapshot. */
export interface IMaintenanceSnapshot {
    hasSubscription: boolean;
    planName: string | null;
    cadence: string | null;
    status: string | null;
    usedHours: number;
    includedHours: number;
    periodEndsAt: string | null;
    openRequests: number;
}

/** Support ticket snapshot. */
export interface ISupportSnapshot {
    open: number;
    awaitingCustomer: number;
    urgent: number;
}

/**
 * Actionable card surfaced at the top of the customer dashboard. Frontend
 * renders up to 5 of these in the "Priority actions" rail. The list is
 * pre-sorted server-side: critical → warning → info, then by dueAt ASC.
 */
export interface IPriorityAction {
    id: string;
    kind:
        | "overdue-invoice"
        | "approval-pending"
        | "support-reply"
        | "change-request-open";
    title: string;
    description: string;
    cta: { label: string; href: string };
    dueAt: string | null;
    severity: "info" | "warning" | "critical";
}

/**
 * Brief summary of the customer's primary organisation. Mirrors the
 * `organizationSummary` block on the frontend dashboard contract.
 */
export interface IOrganizationSummary {
    id: string;
    name: string;
    planName: string | null;
    memberCount: number;
    primaryDomain: string | null;
}

/** The full dashboard aggregate. */
export interface ICustomerDashboard {
    projectsActive: number;
    projectsTotal: number;
    healthRollup: IHealthRollup[];
    approvalsPending: number;
    billing: IDashboardBilling | null;
    maintenance: IMaintenanceSnapshot;
    support: ISupportSnapshot;
    nextMilestone: INextMilestone | null;
    recentActivity: IDashboardActivity[];
    /** Pre-sorted actionable items for the priority-actions rail. */
    priorityActions: IPriorityAction[];
    /** Summary of the user's primary organisation. */
    organizationSummary: IOrganizationSummary | null;
    /** Top-level mirror of `billing.outstanding` for legacy wire consumers. */
    outstandingBalance: number;
    /** Top-level mirror of `support.open` for legacy wire consumers. */
    openTicketCount: number;
    generatedAt: string;
}
