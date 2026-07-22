import { z } from "zod";

const statusWire = z.enum([
    "queued",
    "in-review",
    "decided",
    "escalated",
    "closed",
]);
const decisionWire = z.enum([
    "approved",
    "changes-requested",
    "blocked",
    "escalated",
]);
const reasonWire = z.enum([
    "quality",
    "accuracy",
    "brand-voice",
    "copyright",
    "privacy-pii",
    "sensitive-topic",
    "spam-promotional",
    "off-topic",
    "outdated",
    "legal-disclosure-missing",
    "testimonial-consent-missing",
    "media-infected",
    "media-prohibited",
    "accessibility",
    "other",
]);
const riskWire = z.enum(["low", "medium", "high", "critical"]);

export const listPortfolioQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: statusWire.optional(),
    riskLevel: riskWire.optional(),
    submittedById: z.string().optional(),
    search: z.string().min(1).max(120).optional(),
    consentMissing: z.coerce.boolean().optional(),
    sort: z
        .enum(["createdAt", "lastReviewedAt", "riskLevel", "title"])
        .default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
});

export type IListPortfolioQuery = z.infer<typeof listPortfolioQuerySchema>;

export const decidePortfolioBodySchema = z.object({
    decision: decisionWire,
    reasonCode: reasonWire.nullable().default(null),
    reasonNote: z.string().max(2000).nullable().default(null),
    expectedVersion: z.coerce.number().int().min(0),
    idempotencyKey: z.string().min(8).max(120),
});

export type IDecidePortfolioBody = z.infer<typeof decidePortfolioBodySchema>;