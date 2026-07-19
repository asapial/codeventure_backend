/** C7 — Customer tickets list, new ticket, help center. */

import type { TicketPriorityWire, TicketStatusWire } from "../ticket-detail/ticket-detail.type";

export interface ITicketSummary {
    id: string;
    number: string;
    subject: string;
    status: TicketStatusWire;
    priority: TicketPriorityWire;
    lastUpdatedAt: string;
    unreadByCustomer: boolean;
    projectName: string | null;
}

export interface ICustomerTicketIndex {
    tickets: ITicketSummary[];
    page: number;
    perPage: number;
    total: number;
    filters: {
        statuses: TicketStatusWire[];
        priorities: TicketPriorityWire[];
    };
}

export interface IHelpArticle {
    id: string;
    title: string;
    excerpt: string;
    category: string;
    slug: string;
    updatedAt: string;
}

export interface IHelpSearchResult {
    query: string;
    results: IHelpArticle[];
}