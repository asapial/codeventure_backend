import { z } from "zod";

const scanStatusWire = z.enum([
    "pending",
    "clean",
    "infected",
    "prohibited-content",
    "scan-failed",
]);

const visibilityWire = z.enum([
    "private",
    "internal-team",
    "public-reference",
    "public-featured",
]);

export const listMediaQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    scanStatus: scanStatusWire.optional(),
    visibility: visibilityWire.optional(),
    search: z.string().min(1).max(160).optional(),
    sort: z
        .enum(["startedAt", "completedAt", "fileName", "sizeBytes"])
        .default("startedAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
});

export type IListMediaQuery = z.infer<typeof listMediaQuerySchema>;

export const mediaActionBodySchema = z.object({
    visibility: visibilityWire,
    reasonNote: z.string().max(2000).nullable().default(null),
    idempotencyKey: z.string().min(8).max(120),
});

export type IMediaActionBody = z.infer<typeof mediaActionBodySchema>;
