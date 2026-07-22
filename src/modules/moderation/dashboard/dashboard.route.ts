import { Router } from "express";

import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get("/", dashboardController.getDashboard);

export const dashboardRouter = router;