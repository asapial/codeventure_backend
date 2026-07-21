/**
 * S3 — Staff Ticket Workspace wire types.
 *
 * The workspace returns a single ticket + its full thread (customer messages
 * + internal notes merged into a chronological feed), attachments, macro list,
 * assignment history, and SLA clock.
 */

import type {
    NoteVisibilityWire,
    ResolutionCodeWire,
    SlaSeverityWire,
    TicketPriorityWire,
    TicketStatusWire,
} from "../support.wire.types";

export interface ITicketAssignee {
    id: string;
    name: string | null;
    email: string;
    assignedAt: string;
    reason: string | null;
    assignedByName: string | null;
}

export interface ITicketAttachment {
    id: string;
    name: string;
    mimeType: string | null;
    size: number | null;
    url: string;
}

export interface ITicketParticipant {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    isStaff: boolean;
}

export type WorkspaceMessageKind = "customer-message" | "internal-note" | "system-event";

export interface IWorkspaceMessage {
    id: string;
    kind: WorkspaceMessageKind;
    body: string;
    visibility: TicketStatusWire | NoteVisibilityWire;
    author: ITicketParticipant;
    createdAt: string;
    pinned: boolean;
}

export interface ITicketMacro {
    id: string;
    title: string;
    shortcut: string;
    body: string;
    category: string | null;
    usageCount: number;
}

export interface ITicketSlaClock {
    firstResponseState: "satisfied" | "on-track" | "warning" | "breached";
    resolutionState: "satisfied" | "on-track" | "warning" | "breached";
    minutesSinceOpen: number | null;
    minutesToFirstResponseDue: number | null;
    minutesToResolutionDue: number | null;
    percentElapsedFirst: number | null;
    percentElapsedResolution: number | null;
    policyName: string | null;
}

export interface IEscalationRow {
    id: string;
    severity: SlaSeverityWire;
    fromPriority: TicketPriorityWire;
    toPriority: TicketPriorityWire;
    reason: string;
    etaMinutes: number | null;
    triggeredByName: string | null;
    createdAt: string;
}

export interface ITicketDetail {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string | null;
    category: string;
    status: TicketStatusWire;
    priority: TicketPriorityWire;
    sentiment: "positive" | "neutral" | "negative" | "at-risk" | null;
    organization: {
        id: string;
        name: string;
    };
    requester: ITicketParticipant;
    currentAssignee: ITicketAssignee | null;
    assignmentHistory: ITicketAssignee[];
    slaClock: ITicketSlaClock;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    slaDueAt: string | null;
    thread: IWorkspaceMessage[];
    attachments: ITicketAttachment[];
    macros: ITicketMacro[];
    escalations: IEscalationRow[];
}

export interface IPostMessageResult {
    messageId: string;
    createdAt: string;
}

export interface IPatchResult {
    id: string;
    status: TicketStatusWire;
    priority: TicketPriorityWire;
    updatedAt: string;
    assignee: ITicketAssignee | null;
}

export interface IResolveResult {
    id: string;
    status: "resolved" | "closed";
    resolutionCode: ResolutionCodeWire;
    resolvedAt: string;
}

export interface IEscalateResult {
    id: string;
    escalationId: string;
    priority: TicketPriorityWire;
    severity: SlaSeverityWire;
    createdAt: string;
}