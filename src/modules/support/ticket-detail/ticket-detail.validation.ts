import { z } from "zod";

const ticketId = z.string().min(1).max(80);

const noteVisibility = z.enum(["internal-team", "leadership", "private"]);
const ticketStatus = z.enum(["open", "pending", "on-hold", "resolved", "closed"]);
const ticketPriority = z.enum(["low", "normal", "high", "urgent"]);
const resolutionCode = z.enum([
    "fixed",
    "workaround",
    "duplicate",
    "wont-fix",
    "customer-responded",
    "escalated-to-engineering",
    "billing-adjustment",
    "other",
]);
const slaSeverity = z.enum(["low", "normal", "high", "critical"]);

export const ticketIdParamSchema = z.object({
    params: z.object({ id: ticketId }),
});

/** POST /api/v1/support/tickets/:id/messages — staff reply to customer. */
export const postMessageSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        body: z.string().trim().min(1).max(8000),
        /** "customer" = visible to requester, "internal" = staff-only reply. */
        visibility: z.enum(["customer", "internal"]).default("customer"),
        macroId: z.string().min(1).max(80).optional(),
    }),
});

/** POST /api/v1/support/tickets/:id/notes — staff-internal note. */
export const postNoteSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        body: z.string().trim().min(1).max(8000),
        visibility: noteVisibility.default("internal-team"),
        pinned: z.boolean().optional().default(false),
    }),
});

/** POST /api/v1/support/tickets/:id/macro — insert a canned response. */
export const applyMacroSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        macroId: z.string().min(1).max(80),
    }),
});

/** POST /api/v1/support/tickets/:id/escalate — bump priority + log event. */
export const escalateSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        reason: z.string().trim().min(1).max(500),
        severity: slaSeverity.default("high"),
        etaMinutes: z.number().int().positive().max(60 * 24 * 7).optional(),
    }),
});

/** POST /api/v1/support/tickets/:id/resolve — close with a resolution code. */
export const resolveSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        resolution: resolutionCode,
        note: z.string().trim().max(2000).optional(),
    }),
});

/** POST /api/v1/support/tickets/:id/reopen — flip back to OPEN. */
export const reopenSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        reason: z.string().trim().max(500).optional(),
    }).optional(),
});

/**
 * PATCH /api/v1/support/tickets/:id — bulk field updates.
 * `assigneeId` re-runs the claim flow; `status`/`priority` route to
 * individual handlers so we can write the right audit event.
 */
export const patchTicketSchema = z.object({
    params: z.object({ id: ticketId }),
    body: z.object({
        status: ticketStatus.optional(),
        priority: ticketPriority.optional(),
        assigneeId: z.string().min(1).max(80).nullable().optional(),
        assigneeReason: z.string().trim().max(240).optional(),
    }).refine((b) => Object.keys(b).length > 0, {
        message: "Provide at least one field to update.",
    }),
});

export type PostMessageBody = z.infer<typeof postMessageSchema>["body"];
export type PostNoteBody = z.infer<typeof postNoteSchema>["body"];
export type ApplyMacroBody = z.infer<typeof applyMacroSchema>["body"];
export type EscalateBody = z.infer<typeof escalateSchema>["body"];
export type ResolveBody = z.infer<typeof resolveSchema>["body"];
export type ReopenBody = z.infer<typeof reopenSchema>["body"];
export type PatchTicketBody = z.infer<typeof patchTicketSchema>["body"];