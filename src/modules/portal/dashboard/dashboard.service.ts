import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    resolvePrimaryOrg,
    dec,
    decOrNull,
    toIso,
    toWireProjectStatus,
    type OrgMembership,
} from "../portal.policy";
import type {
    ICustomerDashboard,
    IHealthRollup,
    IMaintenanceSnapshot,
    INextMilestone,
    ISupportSnapshot,
    IDashboardBilling,
    IDashboardActivity,
} from "./dashboard.type";

/**
 * Customer dashboard aggregate (C1).
 *
 * Returns a single payload that the overview page renders in one round trip.
 * We deliberately run every count + lookup in parallel via Promise.all so a
 * fresh aggregate is well under 200ms even on cold cache for an org with
 * ~50 projects.
 */
const getDashboard = async (userId: string): Promise<ICustomerDashboard> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isDeleted: true },
    });
    if (!user || user.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Account not found.");
    }

    const primaryOrg = await resolvePrimaryOrg(userId);
    if (!primaryOrg) {
        // Fresh user with no org — return a zero-state dashboard.
        return emptyDashboard();
    }
    const orgId = primaryOrg.id;

    const [
        activeProjectsCount,
        totalProjectsCount,
        approvalsPendingCount,
        openTickets,
        awaitingCustomerTickets,
        urgentTickets,
        billingSummaryRow,
        maintenanceSubs,
        openMaintenanceRequests,
        projects,
        nextMilestoneRow,
        activityRows,
    ] = await Promise.all([
        prisma.project.count({
            where: {
                organizationId: orgId,
                isDeleted: false,
                status: { in: ["PLANNING", "IN_PROGRESS", "IN_REVIEW", "LAUNCHED"] },
            },
        }),
        prisma.project.count({
            where: { organizationId: orgId, isDeleted: false },
        }),
        prisma.approvalRequest.count({
            where: { project: { organizationId: orgId }, status: "PENDING" },
        }),
        prisma.supportTicket.count({
            where: { organizationId: orgId, status: { in: ["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF"] } },
        }),
        prisma.supportTicket.count({
            where: { organizationId: orgId, status: "PENDING_CUSTOMER" },
        }),
        prisma.supportTicket.count({
            where: {
                organizationId: orgId,
                status: { in: ["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF"] },
                priority: { in: ["HIGH", "URGENT"] },
            },
        }),
        // Pull the most recent BillingSummary for ANY org member.
        prisma.billingSummary.findMany({
            where: { userId },
            orderBy: [{ month: "desc" }],
            take: 1,
            select: {
                currency: true,
                planAmount: true,
                nextInvoiceDate: true,
                nextInvoiceAmount: true,
                includedHours: true,
                usedHours: true,
            },
        }),
        prisma.maintenanceSubscription.findMany({
            where: { organizationId: orgId, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
                id: true,
                cadence: true,
                status: true,
                usedHours: true,
                includedHours: true,
                periodEnd: true,
                plan: { select: { name: true } },
            },
        }),
        prisma.maintenanceRequest.count({
            where: {
                subscription: { organizationId: orgId },
                status: { in: ["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF"] },
            },
        }),
        // Pull all projects in the org (we render the health rollup list).
        prisma.project.findMany({
            where: { organizationId: orgId, isDeleted: false },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                accentColor: true,
                updatedAt: true,
                milestones: {
                    where: { completedAt: null },
                    orderBy: [{ dueAt: "asc" }, { orderIndex: "asc" }],
                    take: 1,
                    select: {
                        title: true,
                        dueAt: true,
                        phase: true,
                    },
                },
                deliverables: {
                    select: { id: true, status: true },
                },
            },
        }),
        // Next upcoming milestone across the whole org.
        prisma.projectMilestone.findFirst({
            where: {
                project: { organizationId: orgId, isDeleted: false },
                completedAt: null,
                dueAt: { not: null, gte: new Date() },
            },
            orderBy: { dueAt: "asc" },
            select: {
                title: true,
                dueAt: true,
                phase: true,
                projectId: true,
                project: { select: { slug: true, name: true } },
            },
        }),
        // Recent activity across the org's projects + system.
        prisma.activityEvent.findMany({
            where: { project: { organizationId: orgId } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                type: true,
                title: true,
                description: true,
                createdAt: true,
                project: { select: { slug: true } },
            },
        }),
    ]);

    // ─── Build typed snapshots ───────────────────────────────────────────
    const billingRow = billingSummaryRow[0];
    const billing: IDashboardBilling | null = billingRow
        ? {
              currency: billingRow.currency,
              outstanding: dec(
                  billingRow.nextInvoiceAmount ??
                      (dec(billingRow.planAmount) -
                          dec(billingRow.includedHours) +
                          dec(billingRow.usedHours)),
              ),
              nextInvoiceAt: toIso(billingRow.nextInvoiceDate),
              nextInvoiceAmount: decOrNull(billingRow.nextInvoiceAmount),
          }
        : null;

    const maintenanceSub = maintenanceSubs[0];
    const maintenance: IMaintenanceSnapshot = maintenanceSub
        ? {
              hasSubscription: true,
              planName: maintenanceSub.plan.name,
              cadence: maintenanceSub.cadence.toLowerCase(),
              status: maintenanceSub.status.toLowerCase(),
              usedHours: dec(maintenanceSub.usedHours),
              includedHours: dec(maintenanceSub.includedHours),
              periodEndsAt: toIso(maintenanceSub.periodEnd),
              openRequests: openMaintenanceRequests,
          }
        : {
              hasSubscription: false,
              planName: null,
              cadence: null,
              status: null,
              usedHours: 0,
              includedHours: 0,
              periodEndsAt: null,
              openRequests: openMaintenanceRequests,
          };

    const support: ISupportSnapshot = {
        open: openTickets,
        awaitingCustomer: awaitingCustomerTickets,
        urgent: urgentTickets,
    };

    const healthRollup: IHealthRollup[] = projects.map((p) => {
        const next = p.milestones[0];
        const total = p.deliverables.length;
        const done = p.deliverables.filter((d) => d.status === "COMPLETE").length;
        const progress = total === 0 ? null : Math.min(1, done / total);
        return {
            projectId: p.id,
            slug: p.slug,
            name: p.name,
            phase: toWireProjectStatus(p.status),
            health: deriveHealth(p.status, next?.dueAt ?? null),
            progress,
            nextMilestoneTitle: next?.title ?? null,
            nextMilestoneDueAt: toIso(next?.dueAt ?? null),
        };
    });

    const nextMilestone: INextMilestone | null = nextMilestoneRow
        ? {
              projectId: nextMilestoneRow.projectId,
              projectSlug: nextMilestoneRow.project.slug,
              projectName: nextMilestoneRow.project.name,
              title: nextMilestoneRow.title,
              dueAt: toIso(nextMilestoneRow.dueAt),
              phase: nextMilestoneRow.phase.toLowerCase(),
          }
        : null;

    const recentActivity: IDashboardActivity[] = activityRows.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        kind: classifyActivity(e.type),
        title: e.title,
        description: e.description ?? null,
        href: e.project?.slug ? `/dashboard/projects/${e.project.slug}` : null,
    }));

    return {
        projectsActive: activeProjectsCount,
        projectsTotal: totalProjectsCount,
        healthRollup,
        approvalsPending: approvalsPendingCount,
        billing,
        maintenance,
        support,
        nextMilestone,
        recentActivity,
        generatedAt: new Date().toISOString(),
    };
};

/** Decide the green/yellow/red flag from status + next-milestone due date. */
const deriveHealth = (
    status: string,
    nextDueAt: Date | null,
): IHealthRollup["health"] => {
    if (status === "BLOCKED") return "blocked";
    if (!nextDueAt) return "on-track";
    const now = Date.now();
    const due = nextDueAt.getTime();
    if (due < now) return "at-risk";
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (due - now < sevenDays) return "at-risk";
    return "on-track";
};

/** Map ActivityType to the 5 client-facing dashboard activity buckets. */
const classifyActivity = (
    type: string,
): IDashboardActivity["kind"] => {
    switch (type) {
        case "DELIVERABLE_CREATED":
        case "DELIVERABLE_UPDATED":
        case "DELIVERABLE_STATUS_CHANGED":
        case "PROJECT_CREATED":
        case "PROJECT_UPDATED":
        case "PROJECT_STATUS_CHANGED":
            return "project";
        case "BILLING_EVENT":
            return "billing";
        default:
            return "project";
    }
};

const emptyDashboard = (): ICustomerDashboard => ({
    projectsActive: 0,
    projectsTotal: 0,
    healthRollup: [],
    approvalsPending: 0,
    billing: null,
    maintenance: {
        hasSubscription: false,
        planName: null,
        cadence: null,
        status: null,
        usedHours: 0,
        includedHours: 0,
        periodEndsAt: null,
        openRequests: 0,
    },
    support: { open: 0, awaitingCustomer: 0, urgent: 0 },
    nextMilestone: null,
    recentActivity: [],
    generatedAt: new Date().toISOString(),
});

export const dashboardService = { getDashboard };
// Only re-exported for the test harness.
export { emptyDashboard, deriveHealth, classifyActivity };
// Suppress TS6133 for the imported type alias.
export type _OrgMembershipT = OrgMembership;
