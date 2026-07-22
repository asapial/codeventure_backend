import { prisma } from "../admin.service";
import type { IAdminDashboard } from "./dashboard.type";

const labels: Record<string, string> = { leads: "Leads", quotes: "Quotes", projects: "Projects", billing: "Billing" };
const getAdminDashboard = async (): Promise<IAdminDashboard> => {
  const [groups, failedJobs, spotlight] = await Promise.all([
    prisma.adminRecord.groupBy({ by: ["feature"], where: { archivedAt: null }, _count: { _all: true } }),
    prisma.adminOutboxJob.count({ where: { status: "FAILED" } }),
    prisma.adminRecord.findFirst({ where: { archivedAt: null, status: { in: ["AT_RISK", "BLOCKED", "OVERDUE", "FAILED", "CRITICAL"] } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const counts = new Map(groups.map(group => [group.feature, group._count._all]));
  const kpis = ["leads", "quotes", "projects", "billing"].map(feature => ({ label: labels[feature]!, value: counts.get(feature) ?? 0, deltaPct: 0, deltaDirection: "flat" as const }));
  const risk = spotlight ?? await prisma.adminRecord.findFirst({ where: { archivedAt: null }, orderBy: { updatedAt: "desc" } });
  return {
    generatedAt: new Date().toISOString(), kpis,
    queues: [{ id: "failed-jobs", label: "Failed jobs", open: failedJobs, slaBreached: failedJobs }],
    weeklyTrend: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map(day => ({ day, leads: 0, quotes: 0, projects: 0 })),
    spotlight: risk ? { type: (["leads", "quotes", "projects", "billing"].includes(risk.feature) ? risk.feature.replace(/s$/, "") : "project") as "lead" | "quote" | "project" | "invoice", id: risk.id, title: risk.title, subtitle: risk.status, href: `/dashboard/admin/${risk.feature}/${risk.id}` } : { type: "lead", id: "none", title: "No operational risks", subtitle: "All monitored work is clear", href: "/dashboard/admin/leads" },
  };
};
export const dashboardService = { getAdminDashboard };
