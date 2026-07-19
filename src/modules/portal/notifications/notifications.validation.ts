import { z } from "zod";

export const listQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        perPage: z.coerce.number().int().min(1).max(50).optional().default(20),
        unreadOnly: z
            .union([z.literal("true"), z.literal("false")])
            .optional()
            .transform((v) => v === "true"),
    }),
});

export const markReadParamSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
});

const channelEnum = z.enum(["email", "sms", "in-app", "push"]);
const kindEnum = z.enum([
    "project-update",
    "approval-requested",
    "approval-responded",
    "invoice-issued",
    "invoice-paid",
    "ticket-reply",
    "ticket-status",
    "maintenance",
    "system",
]);
const digestEnum = z.enum(["instant", "daily", "weekly", "off"]);

export const updatePreferencesSchema = z.object({
    body: z.object({
        channels: z
            .array(
                z.object({
                    channel: channelEnum,
                    enabled: z.boolean(),
                    digestFrequency: digestEnum,
                }),
            )
            .optional(),
        kinds: z
            .array(
                z.object({
                    kind: kindEnum,
                    enabled: z.boolean(),
                    channels: z.array(channelEnum),
                }),
            )
            .optional(),
        quietHours: z
            .object({
                enabled: z.boolean(),
                fromHour: z.number().int().min(0).max(23),
                toHour: z.number().int().min(0).max(23),
                timezone: z.string().min(1).max(80),
            })
            .optional(),
    }),
});

export type ListNotificationsQuery = z.infer<typeof listQuerySchema>["query"];
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesSchema>["body"];