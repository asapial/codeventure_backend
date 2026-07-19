import { describe, expect, it } from "vitest";
import {
    twoFactorVerifySchema,
    twoFactorResendSchema,
} from "./auth-2fa.validation";

describe("twoFactorVerifySchema", () => {
  it("accepts a challengeToken + 6-digit code", () => {
    const result = twoFactorVerifySchema.safeParse({
      body: {
        challengeToken: "abcdefghijklmnopqrstuv",
        code: "123456",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a challengeToken + recovery code", () => {
    const result = twoFactorVerifySchema.safeParse({
      body: {
        challengeToken: "abcdefghijklmnopqrstuv",
        recoveryCode: "ABCD-1234-EFGH-5678",
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults trustDevice to false when omitted", () => {
    const result = twoFactorVerifySchema.safeParse({
      body: {
        challengeToken: "abcdefghijklmnopqrstuv",
        code: "654321",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.trustDevice).toBe(false);
    }
  });

  it("rejects when neither code nor recoveryCode is provided", () => {
    const result = twoFactorVerifySchema.safeParse({
      body: { challengeToken: "abcdefghijklmnopqrstuv" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects when both code and recoveryCode are provided", () => {
    const result = twoFactorVerifySchema.safeParse({
      body: {
        challengeToken: "abcdefghijklmnopqrstuv",
        code: "123456",
        recoveryCode: "ABCD-1234-EFGH-5678",
      },
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["non-numeric code", { challengeToken: "abcdefghijklmnopqrstuv", code: "abc123" }],
    ["5-digit code", { challengeToken: "abcdefghijklmnopqrstuv", code: "12345" }],
    ["7-digit code", { challengeToken: "abcdefghijklmnopqrstuv", code: "1234567" }],
    [
      "malformed recovery code",
      { challengeToken: "abcdefghijklmnopqrstuv", recoveryCode: "ABCD" },
    ],
    [
      "lowercase recovery code",
      { challengeToken: "abcdefghijklmnopqrstuv", recoveryCode: "abcd-1234-efgh-5678" },
    ],
    [
      "short challenge token",
      { challengeToken: "short", code: "123456" },
    ],
  ])("rejects %s", (_label, body) => {
    expect(twoFactorVerifySchema.safeParse({ body }).success).toBe(false);
  });
});

describe("twoFactorResendSchema", () => {
  it("accepts a challenge token", () => {
    const result = twoFactorResendSchema.safeParse({
      body: { challengeToken: "abcdefghijklmnopqrstuv" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty challenge token", () => {
    expect(
      twoFactorResendSchema.safeParse({ body: { challengeToken: "" } }).success,
    ).toBe(false);
  });
});