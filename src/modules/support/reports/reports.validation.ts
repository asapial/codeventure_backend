/**
 * S7 — Support Reports Zod schemas.
 *
 * Validates the date-range, granularity, and tab query parameters used
 * by the reports console. Each tab of the reports UI calls a different
 * endpoint with the same date-range envelope.
 */

import { z } from "zod";

const isoDate = z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
        message: "Invalid ISO date.",
    });

/** Shared date-range window — default to last 30 days. */
export const reportsDateRangeSchema = z
    .object({
        from: isoDate.optional(),
        to: isoDate.optional(),
        granularity: z.enum(["day", "week"]).default("day"),
        organizationId: z.string().uuid().optional(),
    })
    .refine(
        (v) => {
            if (!v.from || !v.to) return true;
            return new Date(v.from).getTime() <= new Date(v.to).getTime();
        },
        { message: "`from` must be earlier than `to`.", path: ["from"] },
    );

export type ReportsDateRange = z.infer<typeof reportsDateRangeSchema>;

/** Audit log filter — used by the "audit" tab. */
export const auditQuerySchema = z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    actorId: z.string().uuid().optional(),
    kind: z.string().trim().min(1).max(64).optional(),
    organizationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** Job-run filter — used by the "jobs" tab. */
export const jobRunQuerySchema = z.object({
    kind: z.string().trim().min(1).max(64).optional(),
    status: z
        .enum(["queued", "running", "succeeded", "failed", "partial"])
        .optional(),
    requestedById: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type JobRunQuery = z.infer<typeof jobRunQuerySchema>;

/** Agent leaderboard filter — used by the "leaderboard" tab. */
export const leaderboardQuerySchema = z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;