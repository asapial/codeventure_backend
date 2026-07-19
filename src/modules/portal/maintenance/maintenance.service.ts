import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    dec,
    decOrNull,
    resolvePrimaryOrg,
    toIso,
    toWireTicketStatus,
} from "../portal.policy";
import type {
    CadenceWire,
    ICustomerMaintenance,
    IMaintenancePlan,
    IMaintenanceReport,
    IMaintenanceRequest,
    IMaintenanceSubscription,
    RequestStatusWire,
    RequestTypeWire,
} from "./maintenance.type";
import type { SubmitMaintenanceRequestBody } from "./maintenance.validation";

const mapCadence = (raw: string): CadenceWire => {
    switch (raw) {
        case "QUARTERLY":
            return "quarterly";
        case "ANNUAL":
            return "annual";
        case "MONTHLY":
        default:
            return "monthly";
    }
};

const mapSubStatus = (
    raw: string,
): IMaintenanceSubscription["status"] => {
    switch (raw) {
        case "PAUSED":
            return "paused";
        case "CANCELLED":
            return "cancelled";
        case "EXPIRED":
            return "expired";
        default:
            return "active";
    }
};

const mapRequestType = (raw: string): RequestTypeWire => {
    switch (raw) {
        case "BUG_FIX":
            return "bug";
        case "CONTENT_EDIT":
            return "content";
        case "PERFORMANCE":
            return "performance";
        case "SECURITY":
            return "security";
        case "BACKUP_RESTORE":
            return "backup";
        case "CONSULT":
            return "consult";
        case "UPDATE":
        default:
            return "update";
    }
};

const mapRequestStatus = (raw: string): RequestStatusWire => {
    switch (raw) {
        case "PENDING_CUSTOMER":
            return "pending-customer";
        case "PENDING_STAFF":
            return "pending-staff";
        case "RESOLVED":
            return "resolved";
        case "CLOSED":
            return "closed";
        case "OPEN":
        default:
            return "open";
    }
};

const emptyMaintenance = (): ICustomerMaintenance => ({
    subscription: null,
    recentReports: [],
    activeRequests: [],
    openRequestCount: 0,
});

const getMaintenance = async (userId: string): Promise<ICustomerMaintenance> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) return emptyMaintenance();

    const subscription = await prisma.maintenanceSubscription.findFirst({
        where: { organizationId: org.id, status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        include: {
            plan: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    priceMonthly: true,
                    currency: true,
                    includedHours: true,
                },
            },
        },
    });

    const plan: IMaintenancePlan | null = subscription
        ? {
              id: subscription.plan.id,
              name: subscription.plan.name,
              cadence: mapCadence(subscription.cadence),
              priceMonthly: decOrNull(subscription.plan.priceMonthly),
              currency: subscription.plan.currency,
              includedHours: dec(subscription.plan.includedHours),
              description: subscription.plan.description,
          }
        : null;

    const subscriptionWire: IMaintenanceSubscription | null = subscription
        ? {
              id: subscription.id,
              plan,
              status: mapSubStatus(subscription.status),
              periodStart: subscription.periodStart.toISOString(),
              periodEnd: toIso(subscription.periodEnd),
              usedHours: dec(subscription.usedHours),
              includedHours: dec(subscription.includedHours),
              websiteUrl: subscription.websiteUrl,
          }
        : null;

    const [reports, requests] = await Promise.all([
        prisma.maintenanceReport.findMany({
            where: subscription
                ? { subscriptionId: subscription.id }
                : { subscription: { organizationId: org.id } },
            orderBy: { periodEnd: "desc" },
            take: 6,
            select: {
                id: true,
                periodStart: true,
                periodEnd: true,
                summary: true,
                workCompleted: true,
                backupsVerified: true,
                securityChecks: true,
                createdAt: true,
            },
        }),
        prisma.maintenanceRequest.findMany({
            where: subscription
                ? { subscriptionId: subscription.id }
                : { subscription: { organizationId: org.id } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                requestType: true,
                priority: true,
                status: true,
                title: true,
                description: true,
                createdAt: true,
            },
        }),
    ]);

    const recentReports: IMaintenanceReport[] = reports.map((r) => ({
        id: r.id,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
        summary: r.summary,
        workCompleted: r.workCompleted,
        backupsVerified: r.backupsVerified,
        securityChecks: r.securityChecks,
        createdAt: r.createdAt.toISOString(),
    }));

    const activeRequests: IMaintenanceRequest[] = requests.map((r) => ({
        id: r.id,
        type: mapRequestType(r.requestType),
        status: mapRequestStatus(r.status),
        priority: r.priority.toLowerCase(),
        ticketStatus: toWireTicketStatus(r.status),
        title: r.title,
        description: r.description,
        submittedAt: r.createdAt.toISOString(),
    }));

    return {
        subscription: subscriptionWire,
        recentReports,
        activeRequests,
        openRequestCount: activeRequests.filter(
            (r) => r.status !== "resolved" && r.status !== "closed",
        ).length,
    };
};

const submitRequest = async (
    userId: string,
    body: SubmitMaintenanceRequestBody,
): Promise<IMaintenanceRequest> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization found.", {
            code: "NO_ORG",
        });
    }

    const subscription = await prisma.maintenanceSubscription.findFirst({
        where: { organizationId: org.id, status: "ACTIVE" },
    });
    if (!subscription) {
        throw new AppError(
            status.FORBIDDEN,
            "Active maintenance subscription required to submit requests.",
            { code: "NO_ACTIVE_SUBSCRIPTION" },
        );
    }

    const created = await prisma.maintenanceRequest.create({
        data: {
            subscriptionId: subscription.id,
            requesterId: userId,
            requestType: body.type.toUpperCase() as
                | "UPDATE"
                | "BUG_FIX"
                | "CONTENT_EDIT"
                | "PERFORMANCE"
                | "SECURITY"
                | "BACKUP_RESTORE"
                | "CONSULT",
            priority: (body.severity.toUpperCase() as
                | "LOW"
                | "NORMAL"
                | "HIGH"
                | "URGENT"),
            title: body.title,
            description: body.description,
            status: "OPEN",
        },
    });

    return {
        id: created.id,
        type: mapRequestType(created.requestType),
        status: "open",
        priority: created.priority.toLowerCase(),
        ticketStatus: "open",
        title: created.title,
        description: created.description,
        submittedAt: created.createdAt.toISOString(),
    };
};

export const maintenanceService = { getMaintenance, submitRequest };