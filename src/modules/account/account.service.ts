import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import type { IAccountSummary, IActivityEvent } from "./account.type";

/** Statuses that count as "active work in flight" on the dashboard. */
const ACTIVE_PROJECT_STATUSES = ["planning", "in_progress", "review", "launched"];

const userScopedProjectWhere = (userId: string) => ({
    isDeleted: false,
    OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
    ],
});

/**
 * Aggregate dashboard data for the authenticated user.
 * Mirrors the frontend `AccountSummary` Zod schema.
 */
const getSummary = async (userId: string): Promise<IAccountSummary> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isDeleted: true },
    });
    if (!user || user.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Account not found.");
    }

    // ── Project roll-up ───────────────────────────────────────────────────────
    const [activeProjects, totalProjects] = await Promise.all([
        prisma.project.count({
            where: {
                ...userScopedProjectWhere(userId),
                status: { in: ACTIVE_PROJECT_STATUSES },
            },
        }),
        prisma.project.count({ where: userScopedProjectWhere(userId) }),
    ]);
    // totalProjects is exposed via meta if the frontend ever wants it
    void totalProjects;

    // ── Billing snapshot (current month) ──────────────────────────────────────
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const billingRow = await prisma.billingSummary.findUnique({
        where: { userId_month: { userId, month } },
        select: {
            currency: true,
            planAmount: true,
            usedHours: true,
            includedHours: true,
            nextInvoiceDate: true,
            nextInvoiceAmount: true,
        },
    });

    const billing = billingRow
        ? {
              currency: billingRow.currency,
              outstanding:
                  billingRow.nextInvoiceAmount !== null
                      ? Number(billingRow.nextInvoiceAmount)
                      : Math.max(
                            0,
                            Number(billingRow.planAmount) -
                                Number(billingRow.includedHours) +
                                Number(billingRow.usedHours),
                        ),
              nextInvoiceAt: billingRow.nextInvoiceDate
                  ? billingRow.nextInvoiceDate.toISOString()
                  : null,
          }
        : null;

    // ── Open invoices (count of billing rows with nextInvoiceDate in future) ──
    const openInvoices = await prisma.billingSummary.count({
        where: { userId, nextInvoiceDate: { gt: now } },
    });

    // ── Unread messages (placeholder — chat module not yet built) ────────────
    const unreadMessages = 0;

    // ── Recent activity ──────────────────────────────────────────────────────
    const events = await prisma.activityEvent.findMany({
        where: {
            OR: [
                { actorId: userId },
                { project: userScopedProjectWhere(userId) },
            ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            projectId: true,
            project: { select: { slug: true } },
        },
    });

    const recentActivity: IActivityEvent[] = events.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        title: e.title,
        description: e.description ?? null,
        href: e.project?.slug
            ? `/account/projects/${e.project.slug}#activity-${e.id}`
            : null,
    }));

    return {
        activeProjects,
        openInvoices,
        unreadMessages,
        billing,
        recentActivity,
    };
};

export const accountService = { getSummary };
