/** C8 — Customer ticket detail, messages, status changes. */

export type TicketStatusWire =
    | "open"
    | "pending"
    | "on-hold"
    | "resolved"
    | "closed";

export type TicketPriorityWire = "low" | "normal" | "high" | "urgent";

export type MessageVisibilityWire = "all" | "customer" | "internal";

export type SenderRoleWire = "customer" | "agent" | "system";

export interface ITicketAttachment {
    id: string;
    name: string;
    mimeType: string | null;
    size: number | null;
    url: string;
}

export interface ITicketMessage {
    id: string;
    body: string;
    visibility: MessageVisibilityWire;
    senderName: string;
    senderRole: SenderRoleWire;
    senderAvatarUrl: string | null;
    createdAt: string;
    attachments: ITicketAttachment[];
}

export interface ITicketDetail {
    id: string;
    number: string;
    subject: string;
    description: string;
    status: TicketStatusWire;
    priority: TicketPriorityWire;
    projectName: string | null;
    submittedByName: string;
    submittedAt: string;
    lastUpdatedAt: string;
    messages: ITicketMessage[];
    attachments: ITicketAttachment[];
}