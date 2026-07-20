/** C5 — Customer maintenance dashboard. */

export type CadenceWire = "monthly" | "quarterly" | "annual";
export type SubscriptionStatusWire =
    | "active"
    | "paused"
    | "ending"
    | "ended";
export type RequestTypeWire =
    | "update"
    | "bug"
    | "content"
    | "performance"
    | "security"
    | "backup"
    | "consult";
export type RequestStatusWire =
    | "open"
    | "pending-customer"
    | "pending-staff"
    | "resolved"
    | "closed";

export interface IMaintenancePlan {
    id: string;
    name: string;
    description: string | null;
    cadence: CadenceWire;
    monthlyPrice: number | null;
    currency: string;
    includedHours: number;
}

export interface IMaintenanceSubscription {
    id: string;
    plan: IMaintenancePlan;
    status: SubscriptionStatusWire;
    websiteUrl: string | null;
    periodStart: string;
    periodEnd: string | null;
    includedHours: number;
    usedHours: number;
}

export interface IMaintenanceReport {
    id: string;
    periodStart: string;
    periodEnd: string;
    summary: string;
    workCompleted: unknown;
    backupsVerified: boolean;
    securityChecks: unknown;
    createdAt: string;
}

export interface IMaintenanceRequest {
    id: string;
    type: RequestTypeWire;
    status: RequestStatusWire;
    priority: "low" | "normal" | "high" | "urgent";
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
}

export interface ICustomerMaintenance {
    subscription: IMaintenanceSubscription | null;
    recentReports: IMaintenanceReport[];
    activeRequests: IMaintenanceRequest[];
    openRequestCount: number;
}