import { describe, expect, it } from "vitest";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    const result = signInSchema.safeParse({
      body: {
        email: "ada@example.com",
        password: "correcthorsebatterystaple",
      },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["missing email", { password: "abcdefgh1" }],
    ["missing password", { email: "ada@example.com" }],
    ["bad email shape", { email: "not-an-email", password: "abcdefgh1" }],
    [
      "short password",
      { email: "ada@example.com", password: "short" },
    ],
  ])("rejects %s", (_label, body) => {
    const result = signInSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("lowercases and trims the email", () => {
    const result = signInSchema.safeParse({
      body: { email: "  ada@example.com  ", password: "abcdefgh1" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.email).toBe("ada@example.com");
    }
  });
});

describe("signUpSchema", () => {
  it("accepts a complete valid payload", () => {
    const result = signUpSchema.safeParse({
      body: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "Sup3rSecret!",
      },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["short name", { name: "A", email: "ada@example.com", password: "Sup3rSecret!" }],
    ["bad email", { name: "Ada Lovelace", email: "nope", password: "Sup3rSecret!" }],
    [
      "short password",
      { name: "Ada Lovelace", email: "ada@example.com", password: "short1" },
    ],
  ])("rejects %s", (_label, body) => {
    expect(signUpSchema.safeParse({ body }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects a non-email", () => {
    expect(
      forgotPasswordSchema.safeParse({ body: { email: "nope" } }).success,
    ).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires a token of at least 20 chars", () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: "short", password: "Sup3rSecret!" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a long token + strong password", () => {
    const result = resetPasswordSchema.safeParse({
      body: {
        token: "abcdefghijklmnopqrstuvwxyz1234",
        password: "Sup3rSecret!",
      },
    });
    expect(result.success).toBe(true);
  });
});
