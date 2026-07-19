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
    generatedAt: string;
}
