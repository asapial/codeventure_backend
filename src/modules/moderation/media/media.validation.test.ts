// Vitest unit tests for the M6 media-library validation schemas.
// These cover wire-format coercion (pageSize, dates) and the enum
// constraints we expose to the dashboard.

import { describe, expect, it } from "vitest";
import {
    listMediaQuerySchema,
    mediaActionBodySchema,
} from "./media.validation.js";

describe("moderation/media validation", () => {
    describe("listMediaQuerySchema", () => {
        it("applies default pagination", () => {
            const result = listMediaQuerySchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.sort).toBe("startedAt");
                expect(result.data.order).toBe("desc");
            }
        });

        it("coerces string pageSize from a query string", () => {
            const result = listMediaQuerySchema.safeParse({
                page: "3",
                pageSize: "50",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(50);
            }
        });

        it("rejects pageSize > 100", () => {
            const result = listMediaQuerySchema.safeParse({ pageSize: 101 });
            expect(result.success).toBe(false);
        });

        it("accepts every wire scan-status enum value", () => {
            for (const v of [
                "pending",
                "clean",
                "infected",
                "prohibited-content",
                "scan-failed",
            ]) {
                const result = listMediaQuerySchema.safeParse({
                    scanStatus: v,
                });
                expect(result.success).toBe(true);
            }
        });

        it("rejects an unknown scan-status enum value", () => {
            const result = listMediaQuerySchema.safeParse({
                scanStatus: "banana",
            });
            expect(result.success).toBe(false);
        });

        it("rejects an unknown sort key", () => {
            const result = listMediaQuerySchema.safeParse({ sort: "updatedAt" });
            expect(result.success).toBe(false);
        });

        it("accepts a bounded search term", () => {
            const result = listMediaQuerySchema.safeParse({ search: "hero.png" });
            expect(result.success).toBe(true);
        });

        it("rejects a search term over 160 characters", () => {
            const result = listMediaQuerySchema.safeParse({
                search: "x".repeat(161),
            });
            expect(result.success).toBe(false);
        });
    });

    describe("mediaActionBodySchema", () => {
        it("requires a visibility, idempotencyKey, and optional reasonNote", () => {
            const result = mediaActionBodySchema.safeParse({
                visibility: "internal-team",
                idempotencyKey: "idem-12345",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reasonNote).toBeNull();
            }
        });

        it("rejects an idempotencyKey shorter than 8 characters", () => {
            const result = mediaActionBodySchema.safeParse({
                visibility: "private",
                idempotencyKey: "short",
            });
            expect(result.success).toBe(false);
        });

        it("rejects an unknown visibility", () => {
            const result = mediaActionBodySchema.safeParse({
                visibility: "secret",
                idempotencyKey: "idem-12345",
            });
            expect(result.success).toBe(false);
        });

        it("rejects a reasonNote over 2000 characters", () => {
            const result = mediaActionBodySchema.safeParse({
                visibility: "private",
                reasonNote: "x".repeat(2001),
                idempotencyKey: "idem-12345",
            });
            expect(result.success).toBe(false);
        });
    });
});
