import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), findFirst: vi.fn() }));
vi.mock("../../lib/prisma", () => ({ prisma: { adminAuditLog: { create: mocks.create }, session: { findFirst: mocks.findFirst } } }));
import { recordAudit, redactAdminValue, requireStepUp } from "./admin.policy";

describe("admin policy", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: "audit-1" }); });
  it("persists a redacted append-only audit envelope", async () => {
    const result = await recordAudit({ actorId: "u1", actorRole: "ADMIN", action: "integration.update", target: { kind: "integration", id: "mail" }, after: { apiKey: "secret", enabled: true }, requestId: "req-1" });
    expect(result.id).toBe("audit-1");
    expect(mocks.create.mock.calls[0]?.[0].data.afterJson).toEqual({ apiKey: "[REDACTED]", enabled: true });
  });
  it("redacts nested credentials without removing safe fields", () => expect(redactAdminValue({ nested: { token: "x", name: "Mail" } })).toEqual({ nested: { token: "[REDACTED]", name: "Mail" } }));
  it("rejects stale step-up state", async () => { mocks.findFirst.mockResolvedValue(null); const next = vi.fn(); await requireStepUp()({ user: { userId: "u", role: "ADMIN", email: "a@b.c" } } as never, {} as never, next); expect(next.mock.calls[0]?.[0]?.code).toBe("STEP_UP_REQUIRED"); });
});
