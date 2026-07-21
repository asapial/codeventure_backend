import { z } from "zod";

/**
 * S4 — Customer Search validation.
 *
 * The search endpoint returns organizations (customers) plus their support
 * health snapshot. Filters map 1:1 to fields on `OrganizationSupportProfile`
 * and `Organization`; `q` is a free-text needle over the org name + slug.
 */

export const customerSearchQuerySchema = z.object({
    q: z.string().trim().min(1).max(120).optional(),
    status: z
        .enum(["active", "at-risk", "churning", "paused"])
        .optional(),
    minHealth: z.coerce.number().int().min(0).max(100).optional(),
    maxHealth: z.coerce.number().int().min(0).max(100).optional(),
    hasOverdueInvoices: z
        .union([z.literal("true"), z.literal("false")])
        .transform((v) => v === "true")
        .optional(),
    hasOpenTickets: z
        .union([z.literal("true"), z.literal("false")])
        .transform((v) => v === "true")
        .optional(),
    sort: z
        .enum(["health-asc", "health-desc", "name-asc", "recent"])
        .default("health-desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type CustomerSearchQuery = z.infer<typeof customerSearchQuerySchema>;