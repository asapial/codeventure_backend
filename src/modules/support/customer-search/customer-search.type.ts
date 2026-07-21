/**
 * S4 — Customer search wire types.
 *
 * The list endpoint returns a paginated envelope; each row is a flat
 * "card" the inbox/dashboard views can render directly.
 */

export interface ICustomerCard {
    organizationId: string;
    slug: string;
    name: string;
    status: "active" | "at-risk" | "churning" | "paused";
    healthScore: number;
    churnRisk: number;
    csatScore: number | null;
    openTicketCount: number;
    awaitingCustomerCount: number;
    overdueInvoiceCount: number;
    lastTouchedAt: string | null;
    lastTouchedBy: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    primaryContact: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

export interface ICustomerSearchResponse {
    rows: ICustomerCard[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}