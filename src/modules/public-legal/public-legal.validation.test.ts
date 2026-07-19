// Vitest unit tests for the public-legal validation schema (P21).
// The schema is intentionally simple: only the URL slug is validated, since
// the body comes from the database and the endpoint is read-only.

import { describe, expect, it } from "vitest";
import { getLegalDocumentSchema, legalSlugSchema } from "./public-legal.validation.js";

describe("public-legal validation", () => {
    describe("legalSlugSchema", () => {
        it("accepts a simple kebab-case slug", () => {
            const result = legalSlugSchema.safeParse("privacy-policy");
            expect(result.success).toBe(true);
        });

        it("accepts a slug with digits", () => {
            const result = legalSlugSchema.safeParse("terms-2026");
            expect(result.success).toBe(true);
        });

        it("rejects slugs shorter than 3 characters", () => {
            const result = legalSlugSchema.safeParse("ab");
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toMatch(/at least 3/);
            }
        });

        it("rejects slugs longer than 60 characters", () => {
            const tooLong = `a${"b".repeat(60)}`;
            const result = legalSlugSchema.safeParse(tooLong);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toMatch(/at most 60/);
            }
        });

        it("rejects uppercase letters", () => {
            const result = legalSlugSchema.safeParse("Privacy-Policy");
            expect(result.success).toBe(false);
        });

        it("rejects slugs that start with a digit", () => {
            const result = legalSlugSchema.safeParse("2026-terms");
            expect(result.success).toBe(false);
        });

        it("rejects slugs that end with a dash", () => {
            const result = legalSlugSchema.safeParse("privacy-");
            expect(result.success).toBe(false);
        });

        it("rejects slugs with underscore characters", () => {
            const result = legalSlugSchema.safeParse("privacy_policy");
            expect(result.success).toBe(false);
        });

        it("rejects slugs with spaces", () => {
            const result = legalSlugSchema.safeParse("privacy policy");
            expect(result.success).toBe(false);
        });

        it("rejects empty slugs", () => {
            const result = legalSlugSchema.safeParse("");
            expect(result.success).toBe(false);
        });
    });

    describe("getLegalDocumentSchema", () => {
        it("wraps the slug in a params-shaped object", () => {
            const result = getLegalDocumentSchema.safeParse({
                params: { slug: "terms-of-service" },
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.params?.slug).toBe("terms-of-service");
            }
        });

        it("rejects when the slug field is missing", () => {
            const result = getLegalDocumentSchema.safeParse({ params: {} });
            expect(result.success).toBe(false);
        });
    });
});
