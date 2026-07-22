import { Router } from "express";
import { dashboardRouter } from "./dashboard/dashboard.route.js";

/** A1-A22 feature routers are mounted here as they are delivered. */
const router = Router();
router.use("/dashboard", dashboardRouter);

export const adminRouter = router;
