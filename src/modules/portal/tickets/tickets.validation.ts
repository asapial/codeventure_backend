import { z } from "zod";

const ticketStatus = z.enum([
    "open",
    "pending",
    "on-hold",
    "resolved",
    "closed",
]);
const ticketPriority = z.enum(["low", "normal", "high", "urgent"]);

export const ticketListQuerySchema = z.object({
    query: z.object({
        q: z.string().trim().min(1).max(120).optional(),
        search: z.string().trim().min(1).max(120).optional(),
        status: ticketStatus.optional(),
        priority: ticketPriority.optional(),
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        perPage: z.coerce.number().int().min(1).max(50).optional().default(20),
    }),
});

export const createTicketSchema = z.object({
    body: z.object({
        subject: z.string().trim().min(3).max(200),
        description: z.string().trim().min(10).max(8000),
        priority: ticketPriority.optional().default("normal"),
        projectId: z.string().optional(),
        attachments: z
            .array(
                z.object({
                    fileId: z.string().min(1),
                    name: z.string().min(1).max(240),
                    mimeType: z.string().max(120).optional(),
                    size: z.number().int().nonnegative().optional(),
                    url: z.string().url(),
                }),
            )
            .optional(),
    }),
});

export const helpSearchSchema = z.object({
    query: z.object({
        q: z.string().trim().min(2).max(200),
        limit: z.coerce.number().int().min(1).max(30).optional().default(8),
    }),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>["query"];
export type CreateTicketBody = z.infer<typeof createTicketSchema>["body"];
export type HelpSearchQuery = z.infer<typeof helpSearchSchema>["query"];