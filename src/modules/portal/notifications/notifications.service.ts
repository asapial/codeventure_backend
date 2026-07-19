import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import type { UpdatePreferencesBody } from "./notifications.validation";
import type {
    INotificationIndex,
    INotificationItem,
    INotificationPreferences,
    NotificationKindWire,
} from "./notifications.type";

/**
 * Bucket raw `kind` strings into wire-level NotificationKindWire.
 * Internal kinds come from event sources; accept any string and route it.
 */
const toWireKind = (kind: string): NotificationKindWire => {
    const k = kind.toLowerCase();
    if (k.includes("project")) return "project-update";
    if (k.includes("approval") && k.includes("request")) {
        return "approval-requested";
    }
    if (k.includes("approval")) return "approval-responded";
    if (k.includes("invoice") && k.includes("paid")) return "invoice-paid";
    if (k.includes("invoice")) return "invoice-issued";
    if (k.includes("ticket") && k.includes("status")) {
        return "ticket-status";
    }
    if (k.includes("ticket") || k.includes("support")) {
        return "ticket-reply";
    }
    if (k.includes("maint")) return "maintenance";
    return "system";
};

const list = async (
    userId: string,
    query: { page: number; perPage: number; unreadOnly: boolean },
): Promise<INotificationIndex> => {
    const { page, perPage, unreadOnly } = query;
    const where = unreadOnly
        ? { userId, readAt: null as const }
        : { userId };
    const skip = (page - 1) * perPage;
    const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            skip,
            take: perPage,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                kind: true,
                title: true,
                body: true,
                createdAt: true,
                readAt: true,
                href: true,
            },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
            where: { userId, readAt: null },
        }),
    ]);

    const wire: INotificationItem[] = items.map((n) => ({
        id: n.id,
        kind: toWireKind(n.kind),
        title: n.title,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt ? n.readAt.toISOString() : null,
        actionUrl: n.href ?? null,
        referenceId: null, // schema does not store a reference id on Notification
    }));

    return { items: wire, unreadCount, page, perPage, total };
};

const markRead = async (
    userId: string,
    notificationId: string,
): Promise<{ id: string; readAt: string }> => {
    const existing = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { userId: true },
    });
    if (!existing || existing.userId !== userId) {
        throw new AppError(
            status.NOT_FOUND,
            "Notification not found.",
            { code: "NOTIFICATION_NOT_FOUND" },
        );
    }
    const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
        select: { id: true, readAt: true },
    });
    return {
        id: updated.id,
        readAt: updated.readAt!.toISOString(),
    };
};

const markAllRead = async (userId: string): Promise<{ updated: number }> => {
    const result = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
    });
    return { updated: result.count };
};

/**
 * Synthesize a wire-shaped INotificationPreferences from the flat
 * `NotificationPreference` (which only stores boolean email flags).
 */
const getPreferences = async (
    userId: string,
): Promise<INotificationPreferences> => {
    const stored = await prisma.notificationPreference.findUnique({
        where: { userId },
    });

    const emailOn = (flag:
        | "emailProject"
        | "emailApproval"
        | "emailInvoice"
        | "emailSupport"
        | "emailMaintenance"
        | "emailSecurity"): boolean =>
        stored ? Boolean(stored[flag]) : true;

    const channels: INotificationPreferences["channels"] = [
        { channel: "email", enabled: true, digestFrequency: "instant" },
        { channel: "sms", enabled: false, digestFrequency: "off" },
        { channel: "in-app", enabled: true, digestFrequency: "instant" },
        { channel: "push", enabled: false, digestFrequency: "off" },
    ];

    const kinds: INotificationPreferences["kinds"] = [
        {
            kind: "project-update",
            enabled: emailOn("emailProject"),
            channels: ["email", "in-app"],
        },
        {
            kind: "approval-requested",
            enabled: emailOn("emailApproval"),
            channels: ["email", "in-app"],
        },
        {
            kind: "approval-responded",
            enabled: emailOn("emailApproval"),
            channels: ["email", "in-app"],
        },
        {
            kind: "invoice-issued",
            enabled: emailOn("emailInvoice"),
            channels: ["email", "in-app"],
        },
        {
            kind: "invoice-paid",
            enabled: emailOn("emailInvoice"),
            channels: ["email", "in-app"],
        },
        {
            kind: "ticket-reply",
            enabled: emailOn("emailSupport"),
            channels: ["email", "in-app"],
        },
        {
            kind: "ticket-status",
            enabled: emailOn("emailSupport"),
            channels: ["email", "in-app"],
        },
        {
            kind: "maintenance",
            enabled: emailOn("emailMaintenance"),
            channels: ["email", "in-app"],
        },
        {
            kind: "system",
            enabled: emailOn("emailSecurity"),
            channels: ["email", "in-app"],
        },
    ];

    return {
        channels,
        kinds,
        quietHours: {
            enabled: false,
            fromHour: 22,
            toHour: 7,
            timezone: "UTC",
        },
    };
};

/**
 * Wire body is { channels, kinds, quietHours } — schema stores only email*
 * booleans, so we map them onto the storage model. Channels/kinds store
 * a coarse boolean (enabled-all-vs-disabled). Quiet hours are not persisted
 * in this schema — return the synthesized value unchanged.
 */
const updatePreferences = async (
    userId: string,
    body: UpdatePreferencesBody,
): Promise<INotificationPreferences> => {
    const patch: Record<string, boolean> = {};
    const anyKindEnabled = (kinds?: { kind: string; enabled: boolean }[]) => {
        if (!kinds || !kinds.length) return undefined;
        return kinds.some((k) => k.enabled);
    };

    const projectOn = anyKindEnabled(
        body.kinds?.filter((k) =>
            ["project-update"].includes(k.kind),
        ),
    );
    const approvalOn = anyKindEnabled(
        body.kinds?.filter((k) =>
            ["approval-requested", "approval-responded"].includes(k.kind),
        ),
    );
    const invoiceOn = anyKindEnabled(
        body.kinds?.filter((k) =>
            ["invoice-issued", "invoice-paid"].includes(k.kind),
        ),
    );
    const supportOn = anyKindEnabled(
        body.kinds?.filter((k) =>
            ["ticket-reply", "ticket-status"].includes(k.kind),
        ),
    );
    const maintenanceOn = anyKindEnabled(
        body.kinds?.filter((k) => k.kind === "maintenance"),
    );
    const securityOn = anyKindEnabled(
        body.kinds?.filter((k) => k.kind === "system"),
    );

    if (projectOn !== undefined) patch.emailProject = projectOn;
    if (approvalOn !== undefined) patch.emailApproval = approvalOn;
    if (invoiceOn !== undefined) patch.emailInvoice = invoiceOn;
    if (supportOn !== undefined) patch.emailSupport = supportOn;
    if (maintenanceOn !== undefined) patch.emailMaintenance = maintenanceOn;
    if (securityOn !== undefined) patch.emailSecurity = securityOn;

    // Channels: a single "email enabled" toggle, derived from the email channel row.
    const emailChannel = body.channels?.find((c) => c.channel === "email");
    if (emailChannel) {
        patch.emailProject = emailChannel.enabled;
        patch.emailApproval = emailChannel.enabled;
        patch.emailInvoice = emailChannel.enabled;
        patch.emailSupport = emailChannel.enabled;
        patch.emailMaintenance = emailChannel.enabled;
        patch.emailSecurity = emailChannel.enabled;
    }

    if (Object.keys(patch).length) {
        await prisma.notificationPreference.upsert({
            where: { userId },
            create: { userId, ...patch },
            update: patch,
        });
    }

    return getPreferences(userId);
};

export const notificationsService = {
    list,
    markRead,
    markAllRead,
    getPreferences,
    updatePreferences,
};