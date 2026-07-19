/** C9 — Customer notifications + preferences. */

export type NotificationKindWire =
    | "project-update"
    | "approval-requested"
    | "approval-responded"
    | "invoice-issued"
    | "invoice-paid"
    | "ticket-reply"
    | "ticket-status"
    | "maintenance"
    | "system";

export type CommunicationChannelWire = "email" | "sms" | "in-app" | "push";

export interface INotificationItem {
    id: string;
    kind: NotificationKindWire;
    title: string;
    body: string;
    createdAt: string;
    readAt: string | null;
    actionUrl: string | null;
    referenceId: string | null;
}

export interface INotificationIndex {
    items: INotificationItem[];
    unreadCount: number;
    page: number;
    perPage: number;
    total: number;
}

export interface INotificationChannelPreference {
    channel: CommunicationChannelWire;
    enabled: boolean;
    digestFrequency: "instant" | "daily" | "weekly" | "off";
}

export interface INotificationKindPreference {
    kind: NotificationKindWire;
    enabled: boolean;
    channels: CommunicationChannelWire[];
}

export interface INotificationPreferences {
    channels: INotificationChannelPreference[];
    kinds: INotificationKindPreference[];
    quietHours: {
        enabled: boolean;
        fromHour: number;
        toHour: number;
        timezone: string;
    };
}