import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    resolvePrimaryOrg,
    dec,
    decOrNull,
    toIso,
    toWireProjectStatus,
} from "../portal.policy";
import type {
    ICustomerDashboard,
    IHealthRollup,
    IMaintenanceSnapshot,
    INextMilestone,
    ISupportSnapshot,
    IDashboardBilling,
    IDashboardActivity,
    IOrganizationSummary,
    IPriorityAction,
} from "./dashboard.type";

/** Cap on the priority-actions rail. Frontend renders up to 5. */
const PRIORITY_ACTIONS_CAP = 5;

/**
 * Customer dashboard aggregate (C1).
 *
 * Returns a single payload that the overview page renders in one round trip.
 *
 * Project scoping: the schema models `Project.ownerId` rather than
 * `Project.organizationId`, so we resolve the user's project IDs via the
 * `ProjectMember` join table. This keeps the wire shape unchanged while
 * honouring the org membership contract.
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

    // Resolve the org's project IDs once. We use this list in every
    // project-scoped query below to avoid repeating the membership filter.
    const projectMemberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
    });
    const memberProjectIds = projectMemberships.map((m) => m.projectId);

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
        overdueInvoices,
        openChangeRequests,
    ] = await Promise.all([
        prisma.project.count({
            where: {
                id: { in: memberProjectIds },
                isDeleted: false,
                status: {
                    in: ["PLANNING", "IN_PROGRESS", "IN_REVIEW", "LAUNCHED"],
                },
            },
        }),
        prisma.project.count({
            where: { id: { in: memberProjectIds }, isDeleted: false },
        }),
        prisma.approvalRequest.count({
            where: { projectId: { in: memberProjectIds }, status: "PENDING" },
        }),
        prisma.supportTicket.count({
            where: {
                organizationId: orgId,
                status: { in: ["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF"] },
            },
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
        // Pull the most recent BillingSummary for this user (org-scoped).
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
        // Pull all projects the user has access to.
        prisma.project.findMany({
            where: { id: { in: memberProjectIds }, isDeleted: false },
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
        // Next upcoming milestone across the user's projects.
        prisma.projectMilestone.findFirst({
            where: {
                projectId: { in: memberProjectIds },
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
        // Recent activity across the user's projects + system.
        prisma.activityEvent.findMany({
            where: { projectId: { in: memberProjectIds } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                type: true,
                title: true,
                description: true,
                createdAt: true,
                projectId: true,
                project: { select: { slug: true } },
            },
        }),
        // Overdue invoices for the priority-actions rail. Group by currency
        // server-side so the UI doesn't have to re-aggregate.
        prisma.invoice.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["SENT", "OVERDUE"] },
                dueAt: { lt: new Date() },
            },
            orderBy: { dueAt: "asc" },
            select: {
                id: true,
                invoiceNumber: true,
                currency: true,
                total: true,
                balance: true,
                dueAt: true,
            },
        }),
        // Open change requests across the user's projects.
        prisma.changeRequest.count({
            where: {
                projectId: { in: memberProjectIds },
                status: "PENDING",
            },
        }),
    ]);

    // ─── Build typed snapshots ───────────────────────────────────────────
    const billingRow = billingSummaryRow[0];
    const billing: IDashboardBilling | null = billingRow
        ? {
              currency: billingRow.currency,
              outstanding: decOrNull(billingRow.nextInvoiceAmount) ?? 0,
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
        const done = p.deliverables.filter((d) => d.status === "COMPLETE")
            .length;
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

    // ─── Priority actions rail (C1) ───────────────────────────────────────
    const priorityActions = buildPriorityActions({
        overdueInvoices,
        approvalsPendingCount,
        awaitingCustomerTickets,
        openChangeRequests,
        memberProjectIds,
    });

    // ─── Organization summary (C1) ────────────────────────────────────────
    const organizationSummary = await buildOrganizationSummary(orgId);

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
        priorityActions,
        organizationSummary,
        outstandingBalance: billing?.outstanding ?? 0,
        openTicketCount: openTickets,
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
    priorityActions: [],
    organizationSummary: null,
    outstandingBalance: 0,
    openTicketCount: 0,
    generatedAt: new Date().toISOString(),
});

/**
 * Build the priority-actions rail. The rail is the only "above the fold"
 * actionable UI on the customer dashboard. Sort: critical > warning > info,
 * then by dueAt ascending so the most urgent items sit on top.
 *
 * Cap at {@link PRIORITY_ACTIONS_CAP} entries.
 */
const buildPriorityActions = (input: {
    overdueInvoices: Array<{
        id: string;
        invoiceNumber: string;
        currency: string;
        total: unknown;
        balance: unknown;
        dueAt: Date;
    }>;
    approvalsPendingCount: number;
    awaitingCustomerTickets: number;
    openChangeRequests: number;
    memberProjectIds: string[];
}): IPriorityAction[] => {
    const actions: IPriorityAction[] = [];

    // 1. Overdue invoices (critical, has dueAt).
    for (const inv of input.overdueInvoices) {
        actions.push({
            id: `invoice:${inv.id}`,
            kind: "overdue-invoice",
            title: `Invoice ${inv.invoiceNumber} is overdue`,
            description: `Balance ${inv.currency} ${dec(inv.balance).toFixed(2)} was due ${toIso(inv.dueAt)}.`,
            cta: { label: "Pay invoice", href: `/dashboard/billing/invoices/${inv.id}` },
            dueAt: toIso(inv.dueAt),
            severity: "critical",
        });
    }

    // 2. Pending approvals (warning, no dueAt).
    if (input.approvalsPendingCount > 0) {
        actions.push({
            id: `approvals:${input.memberProjectIds.join(",")}`,
            kind: "approval-pending",
            title: `${input.approvalsPendingCount} approval${input.approvalsPendingCount === 1 ? "" : "s"} waiting on you`,
            description:
                "Designs, copy, or scope changes need your decision before work continues.",
            cta: {
                label: "Review approvals",
                href: "/dashboard?focus=approvals",
            },
            dueAt: null,
            severity: "warning",
        });
    }

    // 3. Support tickets awaiting the customer (info).
    if (input.awaitingCustomerTickets > 0) {
        actions.push({
            id: `support:awaiting`,
            kind: "support-reply",
            title: `${input.awaitingCustomerTickets} support thread${input.awaitingCustomerTickets === 1 ? "" : "s"} needs a reply`,
            description: "Our team has responded — your turn.",
            cta: {
                label: "Reply",
                href: "/dashboard/support?filter=awaiting",
            },
            dueAt: null,
            severity: "info",
        });
    }

    // 4. Open change requests (info).
    if (input.openChangeRequests > 0) {
        actions.push({
            id: `change-requests:${input.memberProjectIds.join(",")}`,
            kind: "change-request-open",
            title: `${input.openChangeRequests} change request${input.openChangeRequests === 1 ? "" : "s"} open`,
            description:
                "Submitted changes waiting for a cost / timeline estimate.",
            cta: {
                label: "View change requests",
                href: "/dashboard?focus=changes",
            },
            dueAt: null,
            severity: "info",
        });
    }

    const severityWeight: Record<IPriorityAction["severity"], number> = {
        critical: 0,
        warning: 1,
        info: 2,
    };

    return actions
        .sort((a, b) => {
            const s = severityWeight[a.severity] - severityWeight[b.severity];
            if (s !== 0) return s;
            const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
            const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
            return aDue - bDue;
        })
        .slice(0, PRIORITY_ACTIONS_CAP);
};

/**
 * Resolve the primary org summary that the dashboard header card renders.
 * We keep the query separate so it can be cached independently.
 */
const buildOrganizationSummary = async (
    orgId: string,
): Promise<IOrganizationSummary | null> => {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
            id: true,
            name: true,
            slug: true,
            members: { select: { id: true } },
            billingProfile: { select: { paymentProvider: true } },
        },
    });
    if (!org) return null;

    // Best-effort plan name: the customer-portal BillingProfile doesn't store
    // a `planName` field directly, so we surface the payment provider as a
    // proxy until a real plan relationship exists.
    const planName = org.billingProfile?.paymentProvider ?? null;

    return {
        id: org.id,
        name: org.name,
        planName,
        memberCount: org.members.length,
        primaryDomain: null,
    };
};

export const dashboardService = { getDashboard };
// Exported for the test harness.
export { emptyDashboard, deriveHealth, classifyActivity, buildPriorityActions, buildOrganizationSummary };
