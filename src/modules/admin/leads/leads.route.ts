import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { createAdminHandlers } from "../admin.handlers";
import { requireAdmin, requirePermission } from "../admin.policy";
import { adminBodySchema, adminIdBodySchema, adminListSchema } from "../admin.validation";

const router = Router(); const handlers = createAdminHandlers("leads");
router.use(requireAdmin);
router.get("/", requirePermission("leads.read"), validateRequest(adminListSchema), handlers.list);
router.post("/", requirePermission("leads.write"), validateRequest(adminBodySchema), handlers.create("lead"));
router.patch("/bulk", requirePermission("leads.write"), validateRequest(adminBodySchema), handlers.job("leads.bulk-update"));
router.patch("/:id/assign", requirePermission("leads.write"), validateRequest(adminIdBodySchema), handlers.update("assign"));
export const leadsRouter = router;
