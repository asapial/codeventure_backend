import { z } from "zod";

export const ticketIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
});

export const postMessageSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
    body: z.object({
        body: z.string().trim().min(1).max(8000),
        visibility: z
            .enum(["all", "customer", "internal"])
            .optional()
            .default("customer"),
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

export const patchTicketSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
    body: z.object({
        action: z.enum(["close", "reopen"]),
        note: z.string().trim().max(2000).optional(),
    }),
});

export type PostMessageBody = z.infer<typeof postMessageSchema>["body"];
export type PatchTicketBody = z.infer<typeof patchTicketSchema>["body"];