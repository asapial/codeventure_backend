import { describe, expect, it } from "vitest";
import {
    verifyEmailSchema,
    resendVerificationSchema,
} from "./auth-verify-email.validation";

describe("verifyEmailSchema", () => {
  it("accepts an email + 6-digit code", () => {
    const r = verifyEmailSchema.safeParse({
      body: { email: "[email protected]", code: "123456" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts an email + magic-link token", () => {
    const r = verifyEmailSchema.safeParse({
      body: {
        email: "[email protected]",
        token: "abcdefghijklmnopqrstuvwxyz1234",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects when neither code nor token is provided", () => {
    const r = verifyEmailSchema.safeParse({
      body: { email: "[email protected]" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects when both code and token are provided", () => {
    const r = verifyEmailSchema.safeParse({
      body: {
        email: "[email protected]",
        code: "123456",
        token: "abcdefghijklmnopqrstuvwxyz1234",
      },
    });
    expect(r.success).toBe(false);
  });

  it.each([
    ["non-numeric code", { email: "[email protected]", code: "12ab56" }],
    ["5-digit code", { email: "[email protected]", code: "12345" }],
    ["short token", { email: "[email protected]", token: "short" }],
    ["bad email", { email: "nope", code: "123456" }],
  ])("rejects %s", (_label, body) => {
    expect(verifyEmailSchema.safeParse({ body }).success).toBe(false);
  });

  it("lowercases and trims the email", () => {
    const r = verifyEmailSchema.safeParse({
      body: { email: "  [email protected]  ", code: "123456" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body.email).toBe("[email protected]");
    }
  });
});

describe("resendVerificationSchema", () => {
  it("accepts an email", () => {
    expect(
      resendVerificationSchema.safeParse({
        body: { email: "[email protected]" },
      }).success,
    ).toBe(true);
  });

  it("rejects a non-email", () => {
    expect(
      resendVerificationSchema.safeParse({
        body: { email: "nope" },
      }).success,
    ).toBe(false);
  });
});