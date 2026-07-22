import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { createAdminHandlers } from "../admin.handlers";
import { requireAdmin, requirePermission, requireStepUp } from "../admin.policy";
import { adminBodySchema, adminIdBodySchema, adminIdSchema, adminListSchema } from "../admin.validation";

const router = Router(); const handlers = createAdminHandlers("leads");
router.use(requireAdmin);
router.get("/", requirePermission("leads.read"), validateRequest(adminListSchema), handlers.list);
router.post("/", requirePermission("leads.write"), validateRequest(adminBodySchema), handlers.create("lead"));
router.patch("/bulk", requirePermission("leads.write"), validateRequest(adminBodySchema), handlers.job("leads.bulk-update"));
router.patch("/:id/assign", requirePermission("leads.write"), validateRequest(adminIdBodySchema), handlers.update("assign"));
router.post("/:id/activities", requirePermission("leads.write"), validateRequest(adminIdBodySchema), handlers.update("add-activity"));
router.post("/:id/create-quote", requirePermission("leads.write"), validateRequest(adminIdBodySchema), handlers.update("create-quote"));
router.post("/:id/convert", requirePermission("leads.write"), requireStepUp(), validateRequest(adminIdBodySchema), handlers.update("convert"));
router.patch("/:id", requirePermission("leads.write"), validateRequest(adminIdBodySchema), handlers.update("advance"));
router.get("/:id", requirePermission("leads.read"), validateRequest(adminIdSchema), handlers.get);
export const leadsRouter = router;
