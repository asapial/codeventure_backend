import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { maintenanceController } from "./maintenance.controller";
import { submitMaintenanceRequestSchema } from "./maintenance.validation";

const router = Router();

router.get("/", maintenanceController.get);
router.post(
    "/requests",
    validateRequest(submitMaintenanceRequestSchema),
    maintenanceController.submit,
);

export const maintenanceRouter = router;