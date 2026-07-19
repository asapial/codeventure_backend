import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("returns a scrypt-formatted string", async () => {
    const stored = await hashPassword("Sup3rSecret!");
    const parts = stored.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(parts).toHaveLength(6);
  });

  it("rejects passwords shorter than 8 chars", async () => {
    await expect(hashPassword("short1")).rejects.toThrow(
      /at least 8 characters/i,
    );
  });

  it("produces a unique salt per call", async () => {
    const a = await hashPassword("Sup3rSecret!");
    const b = await hashPassword("Sup3rSecret!");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct plain password", async () => {
    const stored = await hashPassword("Sup3rSecret!");
    await expect(verifyPassword("Sup3rSecret!", stored)).resolves.toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const stored = await hashPassword("Sup3rSecret!");
    await expect(verifyPassword("WrongSecret!", stored)).resolves.toBe(false);
  });

  it.each([
    ["empty plain", "", "scrypt$16384$8$1$AAAA$BBBB"],
    ["empty stored", "Sup3rSecret!", ""],
    ["null stored", "Sup3rSecret!", null],
    ["wrong scheme", "Sup3rSecret!", "bcrypt$16384$8$1$AAAA$BBBB"],
    [
      "non-numeric params",
      "Sup3rSecret!",
      "scrypt$NaN$NaN$NaN$AAAA$BBBB",
    ],
  ])("returns false when %s", async (_label, plain, stored) => {
    await expect(
      verifyPassword(plain, stored as string | null | undefined),
    ).resolves.toBe(false);
  });
});
