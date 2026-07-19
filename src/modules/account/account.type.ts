import type { ISessionUser } from "../auth/auth.type";

export interface IActivityEvent {
    id: string;
    at: string; // ISO 8601
    title: string;
    description: string | null;
    href: string | null;
}

export interface IBillingSummary {
    currency: string;
    outstanding: number;
    nextInvoiceAt: string | null;
}

export interface IAccountSummary {
    activeProjects: number;
    openInvoices: number;
    unreadMessages: number;
    billing: IBillingSummary | null;
    recentActivity: IActivityEvent[];
}

/** Re-exported for convenience inside the account module. */
export type { ISessionUser };
