/**
 * Admin Dashboard (A1) — wire types.
 *
 * Mirrors what the frontend `src/app/dashboard/admin/_components/admin-overview.tsx`
 * renders. Keep these in sync; the runtime contract is asserted by
 * `dashboard.service.test.ts` + `admin-overview.test.tsx`.
 */

export type DeltaDirection = "up" | "down" | "flat";

export interface IAdminKpiDelta {
    label: string;
    value: number;
    deltaPct: number;
    deltaDirection: DeltaDirection;
}

export interface IAdminQueue {
    id: string;
    label: string;
    open: number;
    slaBreached: number;
}

export interface IAdminWeeklyTrendPoint {
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    leads: number;
    quotes: number;
    projects: number;
}

export interface IAdminSpotlight {
    type: "lead" | "quote" | "project" | "invoice";
    id: string;
    title: string;
    subtitle: string;
    href: string;
}

export interface IAdminDashboard {
    generatedAt: string; // ISO
    kpis: IAdminKpiDelta[];
    queues: IAdminQueue[];
    weeklyTrend: IAdminWeeklyTrendPoint[];
    spotlight: IAdminSpotlight;
}
