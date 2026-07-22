import { Router } from "express";
import { requireAdmin } from "../admin.policy";
import { dashboardController } from "./dashboard.controller";

const router = Router();

// All admin endpoints sit behind the platform-admin role guard.
router.use(requireAdmin);

router.get("/", dashboardController.getDashboard);

export const dashboardRouter = router;
