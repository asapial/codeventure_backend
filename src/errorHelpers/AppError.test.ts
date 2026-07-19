import { describe, expect, it } from "vitest";
import AppError from "./AppError";

describe("AppError", () => {
  it("stores statusCode and message", () => {
    const err = new AppError(404, "Resource not found.");
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Resource not found.");
  });

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "VALIDATION_ERROR"],
    [429, "RATE_LIMITED"],
    [500, "SERVER_ERROR"],
    [503, "SERVER_ERROR"],
  ])("maps HTTP %i to default code %s", (statusCode, expectedCode) => {
    const err = new AppError(statusCode, "boom");
    expect(err.code).toBe(expectedCode);
  });

  it("lets callers override the default code", () => {
    const err = new AppError(400, "Bad creds", { code: "INVALID_CREDENTIALS" });
    expect(err.code).toBe("INVALID_CREDENTIALS");
  });

  it("attaches fieldErrors when provided", () => {
    const err = new AppError(422, "Invalid input", {
      fieldErrors: { email: ["required"], password: ["too short"] },
    });
    expect(err.fieldErrors).toEqual({ email: ["required"], password: ["too short"] });
  });
});
