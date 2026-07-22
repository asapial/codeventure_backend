import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../admin.service", () => ({ prisma: { adminRecord: { groupBy: vi.fn(), findFirst: vi.fn() }, adminOutboxJob: { count: vi.fn() } } }));
import { prisma } from "../admin.service";
import { dashboardService } from "./dashboard.service";
describe("A1 admin dashboard", () => {
  beforeEach(() => { vi.mocked(prisma.adminRecord.groupBy).mockResolvedValue([] as never); vi.mocked(prisma.adminRecord.findFirst).mockResolvedValue(null); vi.mocked(prisma.adminOutboxJob.count).mockResolvedValue(2); });
  it("aggregates persisted records and failed jobs", async () => { const result = await dashboardService.getAdminDashboard(); expect(result.kpis).toHaveLength(4); expect(result.queues[0]?.open).toBe(2); expect(result.weeklyTrend).toHaveLength(7); });
});
