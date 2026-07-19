/** C5 — Customer maintenance dashboard. */

export type CadenceWire = "weekly" | "biweekly" | "monthly" | "quarterly";
export type SubscriptionStatusWire =
    | "active"
    | "paused"
    | "ending"
    | "ended";
export type RequestTypeWire =
    | "bug"
    | "change"
    | "question"
    | "incident";
export type RequestStatusWire =
    | "submitted"
    | "triaging"
    | "scheduled"
    | "in-progress"
    | "resolved"
    | "closed";

export interface IMaintenancePlan {
    id: string;
    name: string;
    cadence: CadenceWire;
    includes: string[];
    nextVisitAt: string | null;
    monthlyPrice: string | null;
}

export interface IMaintenanceSubscription {
    id: string;
    plan: IMaintenancePlan;
    status: SubscriptionStatusWire;
    startedAt: string;
    endsAt: string | null;
    lastVisitAt: string | null;
}

export interface IMaintenanceReport {
    id: string;
    visitAt: string;
    summary: string;
    items: string[];
    attachments: { id: string; name: string; url: string }[];
}

export interface IMaintenanceRequest {
    id: string;
    type: RequestTypeWire;
    status: RequestStatusWire;
    title: string;
    description: string;
    submittedAt: string;
    scheduledFor: string | null;
    resolvedAt: string | null;
}

export interface ICustomerMaintenance {
    subscription: IMaintenanceSubscription | null;
    recentReports: IMaintenanceReport[];
    activeRequests: IMaintenanceRequest[];
    openRequestCount: number;
}