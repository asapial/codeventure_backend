/**
 * M2 — Unified Review Queue validation schemas.
 *
 * `listReviewsQuerySchema`     — query parser for the queue list endpoint.
 * `decideReviewBodySchema`     — body parser for the decide endpoint.
 */

import { z } from "zod";

// Mirrors the moderation.wire.types enums but expressed as zod unions so the
// runtime input is validated against the same set as the wire format.
const contentTypeWire = z.enum([
    "blog-post",
    "portfolio-case-study",
    "testimonial",
    "media-asset",
    "client-publication",
]);

const moderationStatusWire = z.enum([
    "queued",
    "in-review",
    "decided",
    "escalated",
    "closed",
]);

const riskLevelWire = z.enum(["low", "medium", "high", "critical"]);

const moderationDecisionWire = z.enum([
    "approved",
    "changes-requested",
    "blocked",
    "escalated",
]);

const moderationReasonWire = z.enum([
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

const sortField = z.enum([
    "createdAt",
    "lastReviewedAt",
    "riskLevel",
    "submittedAt",
]);
const sortOrder = z.enum(["asc", "desc"]).default("desc");

export const listReviewsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    contentType: contentTypeWire.optional(),
    status: moderationStatusWire.optional(),
    riskLevel: riskLevelWire.optional(),
    submittedById: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    search: z.string().min(1).max(120).optional(),
    sort: sortField.default("createdAt"),
    order: sortOrder,
    // Filters that translate to "anything open"
    onlyOpen: z.coerce.boolean().default(true),
});

export type IListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const decideReviewBodySchema = z.object({
    decision: moderationDecisionWire,
    reasonCode: moderationReasonWire.nullable().default(null),
    reasonNote: z.string().max(2000).nullable().default(null),
    expectedVersion: z.coerce.number().int().min(0),
    idempotencyKey: z.string().min(8).max(120),
});

export type IDecideReviewBody = z.infer<typeof decideReviewBodySchema>;