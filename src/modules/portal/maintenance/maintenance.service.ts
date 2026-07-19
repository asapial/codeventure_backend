import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    resolvePrimaryOrg,
    toIso,
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
    SubscriptionStatusWire,
} from "./maintenance.type";
import type { SubmitMaintenanceRequestBody } from "./maintenance.validation";

const mapCadence = (raw: string): CadenceWire => {
    switch (raw) {
        case "WEEKLY":
            return "weekly";
        case "BIWEEKLY":
            return "biweekly";
        case "QUARTERLY":
            return "quarterly";
        default:
            return "monthly";
    }
};

const mapSubStatus = (raw: string): SubscriptionStatusWire => {
    switch (raw) {
        case "PAUSED":
            return "paused";
        case "ENDING":
            return "ending";
        case "ENDED":
            return "ended";
        default:
            return "active";
    }
};

const mapRequestType = (raw: string): RequestTypeWire => {
    switch (raw) {
        case "BUG":
            return "bug";
        case "CHANGE":
            return "change";
        case "INCIDENT":
            return "incident";
        default:
            return "question";
    }
};

const mapRequestStatus = (raw: string): RequestStatusWire => {
    switch (raw) {
        case "TRIAGING":
            return "triaging";
        case "SCHEDULED":
            return "scheduled";
        case "IN_PROGRESS":
            return "in-progress";
        case "RESOLVED":
            return "resolved";
        case "CLOSED":
            return "closed";
        default:
            return "submitted";
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
        where: { organizationId: org.id, status: { not: "ENDED" } },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
    });

    const plan: IMaintenancePlan | null = subscription
        ? {
              id: subscription.plan.id,
              name: subscription.plan.name,
              cadence: mapCadence(subscription.plan.cadence),
              includes: subscription.plan.includes,
              nextVisitAt: toIso(subscription.nextVisitAt),
              monthlyPrice: subscription.plan.monthlyPrice?.toString() ?? null,
          }
        : null;

    const subscriptionWire: IMaintenanceSubscription | null = subscription
        ? {
              id: subscription.id,
              plan: plan!,
              status: mapSubStatus(subscription.status),
              startedAt: subscription.startedAt.toISOString(),
              endsAt: toIso(subscription.endsAt),
              lastVisitAt: toIso(subscription.lastVisitAt),
          }
        : null;

    const [reports, requests] = await Promise.all([
        prisma.maintenanceReport.findMany({
            where: subscription
                ? { subscriptionId: subscription.id }
                : { subscription: { organizationId: org.id } },
            orderBy: { visitAt: "desc" },
            take: 6,
        }),
        prisma.maintenanceRequest.findMany({
            where: subscription
                ? { subscriptionId: subscription.id }
                : { subscription: { organizationId: org.id } },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),
    ]);

    const recentReports: IMaintenanceReport[] = reports.map((r) => ({
        id: r.id,
        visitAt: r.visitAt.toISOString(),
        summary: r.summary,
        items: r.items,
        attachments: [],
    }));

    const activeRequests: IMaintenanceRequest[] = requests.map((r) => ({
        id: r.id,
        type: mapRequestType(r.type),
        status: mapRequestStatus(r.status),
        title: r.title,
        description: r.description,
        submittedAt: r.createdAt.toISOString(),
        scheduledFor: toIso(r.scheduledFor),
        resolvedAt: toIso(r.resolvedAt),
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
            submittedById: userId,
            type: body.type.toUpperCase(),
            severity: body.severity.toUpperCase(),
            title: body.title,
            description: body.description,
            status: "SUBMITTED",
        },
    });

    return {
        id: created.id,
        type: mapRequestType(created.type),
        status: "submitted",
        title: created.title,
        description: created.description,
        submittedAt: created.createdAt.toISOString(),
        scheduledFor: null,
        resolvedAt: null,
    };
};

export const maintenanceService = { getMaintenance, submitRequest };