// Vitest unit tests for the M7 audit-timeline validation schema.
// `kind`, `contentType`, and `customerVisible` are the high-traffic
// filter inputs the dashboard uses; they have to be strict.

import { describe, expect, it } from "vitest";
import { listAuditQuerySchema } from "./audit.validation.js";

describe("moderation/audit validation", () => {
    describe("listAuditQuerySchema", () => {
        it("applies default pagination + sort", () => {
            const result = listAuditQuerySchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(25);
                expect(result.data.sort).toBe("createdAt");
                expect(result.data.order).toBe("desc");
            }
        });

        it("accepts every moderation audit kind", () => {
            const kinds = [
                "CONTENT_APPROVED",
                "CONTENT_BLOCKED",
                "CONTENT_CHANGES_REQUESTED",
                "CONTENT_ESCALATED",
                "MEDIA_QUARANTINED",
                "MEDIA_CLEARED",
                "TESTIMONIAL_CONSENT_VERIFIED",
                "CLIENT_PUBLICATION_APPROVED",
                "CLIENT_PUBLICATION_REVOKED",
            ];
            for (const k of kinds) {
                const result = listAuditQuerySchema.safeParse({ kind: k });
                expect(result.success).toBe(true);
            }
        });

        it("rejects a non-modulation audit kind (e.g. AUTH_LOGIN)", () => {
            const result = listAuditQuerySchema.safeParse({
                kind: "AUTH_LOGIN",
            });
            expect(result.success).toBe(false);
        });

        it("accepts ISO date strings for `from` and `to`", () => {
            const result = listAuditQuerySchema.safeParse({
                from: "2026-07-01T00:00:00Z",
                to: "2026-07-31T23:59:59Z",
            });
            expect(result.success).toBe(true);
        });

        it("rejects an unparseable date string", () => {
            const result = listAuditQuerySchema.safeParse({
                from: "yesterday",
            });
            expect(result.success).toBe(false);
        });

        it("coerces `customerVisible=true` from a query string", () => {
            const result = listAuditQuerySchema.safeParse({
                customerVisible: "true",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.customerVisible).toBe(true);
            }
        });

        it("rejects pageSize over 100", () => {
            const result = listAuditQuerySchema.safeParse({ pageSize: 250 });
            expect(result.success).toBe(false);
        });

        it("accepts an unknown sort key only if it's 'createdAt'", () => {
            const result = listAuditQuerySchema.safeParse({ sort: "actorId" });
            expect(result.success).toBe(false);
        });
    });
});
