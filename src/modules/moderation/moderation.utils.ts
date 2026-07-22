/**
 * Shared helpers for the moderation module.
 *
 * Pagination, sort-allow-list parsing, and a small `truncate` helper used
 * by M2/M3/M4/M5/M6 list views. Mirrors `support.utils.ts` so the surface
 * conventions match.
 */

export interface PaginationInput {
    page?: number | string | null;
    pageSize?: number | string | null;
}

export interface PaginationOutput {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
}

export const parsePagination = (input: PaginationInput): PaginationOutput => {
    const pageNum = Number(input.page ?? 1);
    const sizeNum = Number(input.pageSize ?? 25);
    const page = Math.max(
        1,
        Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1,
    );
    const pageSize = Math.max(
        1,
        Math.min(100, Number.isFinite(sizeNum) && sizeNum > 0 ? Math.floor(sizeNum) : 25),
    );
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export interface SortInput<TAllowed extends Record<string, unknown>> {
    sort?: string | null;
    order?: string | null;
    allowed: TAllowed;
    defaultSort: keyof TAllowed & string;
}

export const parseSort = <TAllowed extends Record<string, unknown>>(
    input: SortInput<TAllowed>,
): TAllowed[keyof TAllowed] => {
    const sortKey = (input.sort ?? input.defaultSort) as keyof TAllowed & string;
    const orderBy = input.allowed[sortKey] ?? input.allowed[input.defaultSort];
    return orderBy;
};

export const truncate = (s: string, max: number): string => {
    if (!s) return "";
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
};

/**
 * Coerce a query-string boolean into a real boolean. The query schema
 * accepts both `"true"`/`"false"` (raw form) and `true`/`false` (when the
 * framework already coerced it).
 */
export const asBool = (v: unknown): boolean => {
    if (v === true) return true;
    if (v === false) return false;
    if (typeof v === "string") return v.toLowerCase() === "true";
    return false;
};

/**
 * Compute a small numeric "risk score" for a case. The dashboard uses
 * this to bucket KPI cards into "needs attention". Pure function so it
 * can be unit-tested without DB I/O.
 */
export const computeRiskScore = (input: {
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    minutesSinceQueued: number | null;
    consentMissing: boolean;
}): number => {
    const base = {
        LOW: 10,
        MEDIUM: 30,
        HIGH: 60,
        CRITICAL: 90,
    }[input.riskLevel];
    const ageBoost =
        input.minutesSinceQueued === null
            ? 0
            : Math.min(30, Math.floor(input.minutesSinceQueued / 60));
    const consentBoost = input.consentMissing ? 20 : 0;
    return Math.min(100, base + ageBoost + consentBoost);
};