import { Router } from "express"; import { catchAsync } from "../../../utils/catchAsync"; import { validateRequest } from "../../../middleware/validateRequest";
import { createAdminHandlers } from "../admin.handlers"; import { requireAdmin, requirePermission } from "../admin.policy"; import { prisma } from "../admin.service"; import { adminBodySchema, adminListSchema } from "../admin.validation";
export const auditLogOperations = [["get", "/audit-log"], ["post", "/audit-log/export"]] as const;
const router = Router(); const handlers = createAdminHandlers("audit-log"); router.use(requireAdmin);
router.get("/audit-log", requirePermission("audit.read"), validateRequest(adminListSchema), catchAsync(async (req, res) => {
  const page = Number(req.query.page ?? 1); const pageSize = Number(req.query.pageSize ?? 25); const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const where = q ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { targetId: { contains: q, mode: "insensitive" as const } }, { requestId: { contains: q, mode: "insensitive" as const } }] } : {};
  const [data, total] = await prisma.$transaction([prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.adminAuditLog.count({ where })]);
  res.json({ data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), requestId: req.id } });
}));
router.post("/audit-log/export", requirePermission("audit.read"), validateRequest(adminBodySchema), handlers.job("audit.export"));
export const auditLogRouter = router;
