/**
 * S2 — Support Ticket Inbox wire types.
 *
 * The inbox is a paged list of tickets with computed SLA clocks + assignee
 * state. The frontend uses these to drive the filterable table + claim CTA.
 */

import type {
    TicketStatusWire,
    TicketPriorityWire,
    SentimentWire,
} from "../support.wire.types";
import type { IPagedResponse } from "../support.wire.types";

export interface IInboxTicketRow {
    ticketId: string;
    ticketNumber: string;
    subject: string;
    organizationName: string;
    organizationId: string;
    status: TicketStatusWire;
    priority: TicketPriorityWire;
    sentiment: SentimentWire;
    requesterName: string | null;
    requesterEmail: string | null;
    assignee: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    messageCount: number;
    internalNoteCount: number;
    firstResponseState: "satisfied" | "on-track" | "warning" | "breached";
    resolutionState: "satisfied" | "on-track" | "warning" | "breached";
    minutesSinceOpen: number;
    minutesToResolutionDue: number | null;
    lastUpdatedAt: string;
    lastMessagePreview: string | null;
    lastMessageAt: string | null;
}

export type IInboxListResponse = IPagedResponse<IInboxTicketRow> & {
    filters: {
        statuses: TicketStatusWire[];
        priorities: TicketPriorityWire[];
        assignees: { id: string; name: string | null; email: string }[];
    };
    slaCounts: {
        breached: number;
        warning: number;
        onTrack: number;
    };
};

export interface IClaimResult {
    ticketId: string;
    assignedTo: {
        id: string;
        name: string | null;
        email: string;
    };
    assignedAt: string;
}