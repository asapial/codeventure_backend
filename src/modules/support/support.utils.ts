/**
 * Generic helpers for the support console — pagination, sort parsing,
 * risk scoring, ticket-freshness windows. These are deliberately
 * pure / DB-free so they can be unit-tested in support.utils.test.ts.
 */

import type { Prisma } from "../../../prisma/generated/prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalisedPage {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
}

export interface PaginationInput {
    page?: number | string | null | undefined;
    pageSize?: number | string | null | undefined;
    /** Default page size if the caller doesn't pass one. */
    defaultPageSize?: number;
    /** Hard cap on page size so callers can't DOS the API. */
    maxPageSize?: number;
}

const PAGE_DEFAULTS = { page: 1, pageSize: 25, maxPageSize: 100 } as const;

/**
 * Normalise a raw `(page, pageSize)` pair coming off the query string
 * (Express delivers these as strings). Returns integers suitable for
 * Prisma's `skip` / `take`.
 */
export const parsePagination = (input: PaginationInput = {}): NormalisedPage => {
    const pageRaw = input.page;
    const pageSizeRaw = input.pageSize;
    const defaultPageSize = input.defaultPageSize ?? PAGE_DEFAULTS.pageSize;
    const maxPageSize = input.maxPageSize ?? PAGE_DEFAULTS.maxPageSize;

    const pageParsed =
        pageRaw === undefined || pageRaw === null || pageRaw === ""
            ? PAGE_DEFAULTS.page
            : Number(pageRaw);
    const sizeParsed =
        pageSizeRaw === undefined || pageSizeRaw === null || pageSizeRaw === ""
            ? defaultPageSize
            : Number(pageSizeRaw);

    const page =
        Number.isFinite(pageParsed) && pageParsed >= 1 ? Math.floor(pageParsed) : PAGE_DEFAULTS.page;
    const size =
        Number.isFinite(sizeParsed) && sizeParsed >= 1 ? Math.floor(sizeParsed) : defaultPageSize;
    const pageSize = Math.min(size, maxPageSize);

    return {
        page,
        pageSize,
        skip: (page - 1) * pageSize,
        take: pageSize,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sort
// ─────────────────────────────────────────────────────────────────────────────

export interface SortInput {
    sort?: string | null | undefined;
    order?: "asc" | "desc" | string | null | undefined;
    /** Allowed `sort` keys, mapped to actual Prisma orderBy fields. */
    allowed: Record<string, Prisma.SupportTicketOrderByWithRelationInput>;
    /** Fallback sort when the caller doesn't pass one. */
    defaultSort?: string;
}

const DEFAULT_INBOX_SORT = "updatedAt" as const;

/**
 * Validate a `(sort, order)` pair and translate it to a Prisma `orderBy`.
 * Unknown sort keys are silently downgraded to the default; unknown
 * orders fall back to descending (newest first — matches inbox UX).
 */
export const parseSort = <T extends SortInput>(input: T): Prisma.SupportTicketOrderByWithRelationInput => {
    const sortKey = (input.sort ?? input.defaultSort ?? DEFAULT_INBOX_SORT) as string;
    const order: "asc" | "desc" =
        input.order === "asc" ? "asc" : "desc";
    const mapped = input.allowed[sortKey];
    if (!mapped) {
        const fallback = input.allowed[input.defaultSort ?? DEFAULT_INBOX_SORT]
            ?? input.allowed[DEFAULT_INBOX_SORT];
        return fallback ?? { updatedAt: "desc" };
    }
    // The mapped value is already an object — order wins.
    return order === "asc"
        ? Object.fromEntries(Object.entries(mapped).map(([k]) => [k, "asc"])) as Prisma.SupportTicketOrderByWithRelationInput
        : mapped;
};

// ─────────────────────────────────────────────────────────────────────────────
// Inbox query builder
// ─────────────────────────────────────────────────────────────────────────────

export interface InboxFilterInput {
    q?: string | null | undefined;
    status?: string | null | undefined;
    priority?: string | null | undefined;
    assigneeId?: string | null | undefined;
    slaBreached?: boolean | string | null | undefined;
    organizationId?: string | null | undefined;
    unassigned?: boolean | string | null | undefined;
}

const TICKET_STATUS_MAP: Record<string, string[]> = {
    open: ["OPEN"],
    pending: ["PENDING_CUSTOMER", "PENDING_STAFF"],
    "on-hold": ["ON_HOLD"],
    resolved: ["RESOLVED"],
    closed: ["CLOSED"],
};

const TICKET_PRIORITY_MAP: Record<string, string[]> = {
    low: ["LOW"],
    normal: ["NORMAL"],
    high: ["HIGH"],
    urgent: ["URGENT"],
};

/**
 * Build the Prisma `where` clause for the inbox query. Pure function
 * so the same code path is exercised by unit tests + supertest.
 */
export const buildInboxWhere = (input: InboxFilterInput): Prisma.SupportTicketWhereInput => {
    const where: Prisma.SupportTicketWhereInput = {};

    if (input.organizationId) {
        where.organizationId = input.organizationId;
    }

    if (input.q && input.q.trim().length >= 1) {
        const q = input.q.trim();
        where.OR = [
            { subject: { contains: q, mode: "insensitive" } },
            { ticketNumber: { contains: q, mode: "insensitive" } },
            { requester: { name: { contains: q, mode: "insensitive" } } },
            { requester: { email: { contains: q, mode: "insensitive" } } },
        ];
    }

    if (input.status && TICKET_STATUS_MAP[input.status]) {
        where.status = { in: TICKET_STATUS_MAP[input.status] as never };
    }

    if (input.priority && TICKET_PRIORITY_MAP[input.priority]) {
        where.priority = { in: TICKET_PRIORITY_MAP[input.priority] as never };
    }

    if (input.assigneeId) {
        where.supportAssignments = {
            some: { agentId: input.assigneeId, isCurrent: true },
        };
    } else if (input.unassigned === true || input.unassigned === "true") {
        where.supportAssignments = { none: { isCurrent: true } };
    }

    // SLA-breached filter — caller computes against the SlaPolicy on the row.
    // We can't express it in pure Prisma, so the inbox service runs an
    // additional post-filter. We still mark `where.slaBreached = true`
    // so callers can see it was requested.
    if (input.slaBreached === true || input.slaBreached === "true") {
        // intentional no-op; flagged for post-filter in inbox.service.
        Object.assign(where, { __slaBreached: true } as object);
    }

    return where;
};

// ─────────────────────────────────────────────────────────────────────────────
// Risk / health scoring (S5 customer profile)
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskInput {
    openTicketCount: number;
    awaitingCustomerCount: number;
    overdueInvoiceCount: number;
    avgFirstResponseMin: number | null;
    avgResolutionMin: number | null;
    csatScore: number | null; // 0..100
    churnRiskFlag: boolean;
}

export interface RiskScore {
    score: number; // 0..100 — 100 = healthiest
    band: "healthy" | "watch" | "at-risk" | "critical";
    factors: { label: string; penalty: number }[];
}

/**
 * Score a customer account 0..100. Pure function so tests can pin the
 * thresholds exactly. Bands are chosen to match the S5 wire format.
 */
export const computeAccountHealth = (input: RiskInput): RiskScore => {
    const factors: { label: string; penalty: number }[] = [];
    let score = 100;

    // Open tickets penalty
    if (input.openTicketCount >= 8) {
        const p = Math.min(30, input.openTicketCount * 2);
        factors.push({ label: `${input.openTicketCount} open tickets`, penalty: p });
        score -= p;
    } else if (input.openTicketCount >= 3) {
        const p = input.openTicketCount * 2;
        factors.push({ label: `${input.openTicketCount} open tickets`, penalty: p });
        score -= p;
    }

    // Awaiting customer (>2 days)
    if (input.awaitingCustomerCount >= 3) {
        const p = Math.min(15, input.awaitingCustomerCount * 3);
        factors.push({ label: `${input.awaitingCustomerCount} awaiting customer`, penalty: p });
        score -= p;
    }

    // Overdue invoices
    if (input.overdueInvoiceCount > 0) {
        const p = Math.min(25, input.overdueInvoiceCount * 10);
        factors.push({ label: `${input.overdueInvoiceCount} overdue invoices`, penalty: p });
        score -= p;
    }

    // Slow first response
    if (input.avgFirstResponseMin !== null && input.avgFirstResponseMin > 240) {
        const p = Math.min(15, Math.floor(input.avgFirstResponseMin / 60));
        factors.push({
            label: `Avg first response ${Math.round(input.avgFirstResponseMin)}m`,
            penalty: p,
        });
        score -= p;
    }

    // Slow resolution
    if (input.avgResolutionMin !== null && input.avgResolutionMin > 1440) {
        const p = Math.min(20, Math.floor(input.avgResolutionMin / 240));
        factors.push({
            label: `Avg resolution ${Math.round(input.avgResolutionMin / 60)}h`,
            penalty: p,
        });
        score -= p;
    }

    // CSAT
    if (input.csatScore !== null && input.csatScore < 80) {
        const p = Math.min(25, Math.floor((80 - input.csatScore) * 0.6));
        factors.push({ label: `CSAT ${Math.round(input.csatScore)}%`, penalty: p });
        score -= p;
    }

    // Hard flag
    if (input.churnRiskFlag) {
        factors.push({ label: "Churn risk flagged", penalty: 20 });
        score -= 20;
    }

    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    const band: RiskScore["band"] =
        clamped >= 80 ? "healthy" :
        clamped >= 60 ? "watch" :
        clamped >= 35 ? "at-risk" :
        "critical";

    return { score: clamped, band, factors };
};

// ─────────────────────────────────────────────────────────────────────────────
// Misc helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inclusive list of the past `days` days as `YYYY-MM-DD` strings,
 * ending at `now`. Used by S7 reports date-range widgets.
 */
export const lastNDays = (days: number, now: Date = new Date()): string[] => {
    const out: string[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() - i);
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
};

/**
 * Truncate a string to `max` characters, appending an ellipsis when cut.
 * Used in dashboard cards and inbox subjects.
 */
export const truncate = (s: string, max: number): string => {
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
};

/**
 * Normalise a query-string boolean. Accepts `true`, `"true"`, `"1"`,
 * `1` → true; everything else (including undefined) → false.
 */
export const asBool = (v: unknown): boolean => {
    if (v === true || v === "true" || v === "1" || v === 1) return true;
    return false;
};