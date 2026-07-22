import { z } from "zod";

const auditKindWire = z.enum([
    "CONTENT_APPROVED",
    "CONTENT_BLOCKED",
    "CONTENT_CHANGES_REQUESTED",
    "CONTENT_ESCALATED",
    "MEDIA_QUARANTINED",
    "MEDIA_CLEARED",
    "TESTIMONIAL_CONSENT_VERIFIED",
    "CLIENT_PUBLICATION_APPROVED",
    "CLIENT_PUBLICATION_REVOKED",
]);

const contentTypeWire = z.enum([
    "blog-post",
    "portfolio-case-study",
    "testimonial",
    "media-asset",
    "client-publication",
]);

export const listAuditQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    kind: auditKindWire.optional(),
    actorId: z.string().optional(),
    targetRef: z.string().optional(),
    contentType: contentTypeWire.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    customerVisible: z.coerce.boolean().optional(),
    sort: z.enum(["createdAt"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
});

export type IListAuditQuery = z.infer<typeof listAuditQuerySchema>;