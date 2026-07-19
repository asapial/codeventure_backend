import { describe, expect, it } from "vitest";
import {
    registerSchema,
    acceptInvitationSchema,
    signupSourceSchema,
    accountRoleSchema,
} from "./auth-register.validation";

describe("signupSourceSchema", () => {
  it.each([
    "direct",
    "organic-search",
    "paid-ad",
    "social",
    "referral",
    "email-campaign",
    "other",
  ])("accepts %s", (src) => {
    expect(signupSourceSchema.safeParse(src).success).toBe(true);
  });

  it("rejects unknown sources", () => {
    expect(signupSourceSchema.safeParse("teleport").success).toBe(false);
  });
});

describe("accountRoleSchema", () => {
  it.each(["owner", "admin", "editor", "viewer"])("accepts %s", (r) => {
    expect(accountRoleSchema.safeParse(r).success).toBe(true);
  });

  it("rejects unknown roles", () => {
    expect(accountRoleSchema.safeParse("god-mode").success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    email: "ada@example.com",
    password: "Sup3rSecret!",
    firstName: "Ada",
    lastName: "Lovelace",
    acceptTerms: true,
    acceptPrivacy: true,
  };

  it("accepts a complete valid payload", () => {
    const r = registerSchema.safeParse({ body: valid });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body.marketingOptIn).toBe(false);
    }
  });

  it("accepts a payload with all optional fields", () => {
    const r = registerSchema.safeParse({
      body: {
        ...valid,
        signupSource: "referral",
        referralCode: "GROWTH-FEB",
        marketingOptIn: true,
        inviteToken: "abcdefghijklmnopqrstuv",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects when acceptTerms is not true", () => {
    const r = registerSchema.safeParse({
      body: { ...valid, acceptTerms: false },
    });
    expect(r.success).toBe(false);
  });

  it("rejects when acceptPrivacy is missing", () => {
    const { acceptPrivacy, ...rest } = valid;
    const r = registerSchema.safeParse({ body: rest });
    expect(r.success).toBe(false);
  });

  it("rejects an empty first or last name", () => {
    const r = registerSchema.safeParse({
      body: { ...valid, firstName: " " },
    });
    expect(r.success).toBe(false);
  });

  it("rejects a too-short password", () => {
    const r = registerSchema.safeParse({ body: { ...valid, password: "short1" } });
    expect(r.success).toBe(false);
  });

  it("rejects a password missing required character classes", () => {
    const r = registerSchema.safeParse({
      body: { ...valid, password: "allowercaseno" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects honeypot filled in", () => {
    const r = registerSchema.safeParse({
      body: { ...valid, website: "https://spam.example" },
    });
    expect(r.success).toBe(false);
  });

  it("lowercases the email", () => {
    const r = registerSchema.safeParse({
      body: { ...valid, email: "  ada@example.com  " },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body.email).toBe("ada@example.com");
    }
  });
});

describe("acceptInvitationSchema", () => {
  const valid = {
    token: "abcdefghijklmnopqrstuv",
    firstName: "Ada",
    lastName: "Lovelace",
    password: "Sup3rSecret!",
    acceptTerms: true,
  };

  it("accepts a valid invite payload", () => {
    expect(acceptInvitationSchema.safeParse({ body: valid }).success).toBe(true);
  });

  it("rejects a missing acceptTerms", () => {
    const { acceptTerms, ...rest } = valid;
    expect(acceptInvitationSchema.safeParse({ body: rest }).success).toBe(false);
  });

  it("rejects a weak password", () => {
    expect(
      acceptInvitationSchema.safeParse({
        body: { ...valid, password: "weak" },
      }).success,
    ).toBe(false);
  });

  it("rejects a short token", () => {
    expect(
      acceptInvitationSchema.safeParse({
        body: { ...valid, token: "x" },
      }).success,
    ).toBe(false);
  });
});