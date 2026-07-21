import { z } from "zod";

const ticketStatus = z.enum(["open", "pending", "on-hold", "resolved", "closed"]);
const ticketPriority = z.enum(["low", "normal", "high", "urgent"]);

export const inboxListQuerySchema = z.object({
    query: z.object({
        q: z.string().trim().min(1).max(200).optional(),
        status: ticketStatus.optional(),
        priority: ticketPriority.optional(),
        assigneeId: z.string().min(1).max(80).optional(),
        unassigned: z
            .union([z.literal("true"), z.literal("false"), z.boolean()])
            .optional(),
        slaBreached: z
            .union([z.literal("true"), z.literal("false"), z.boolean()])
            .optional(),
        organizationId: z.string().min(1).max(80).optional(),
        sort: z
            .enum(["updatedAt", "createdAt", "priority", "ticketNumber", "slaDueAt"])
            .optional()
            .default("updatedAt"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
    }),
});

export const claimTicketSchema = z.object({
    params: z.object({
        ticketId: z.string().min(1).max(80),
    }),
    body: z.object({
        reason: z.string().trim().max(240).optional(),
    }).optional(),
});

export type InboxListQuery = z.infer<typeof inboxListQuerySchema>["query"];
export type ClaimTicketParams = z.infer<typeof claimTicketSchema>["params"];
export type ClaimTicketBody = z.infer<typeof claimTicketSchema>["body"];