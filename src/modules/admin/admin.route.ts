import { Router } from "express";
import { dashboardRouter } from "./dashboard/dashboard.route.js";
import { leadsRouter } from "./leads/leads.route.js";
import { quotesRouter } from "./quotes/quotes.route.js";
import { customersRouter } from "./customers/customers.route.js";

/** A1-A22 feature routers are mounted here as they are delivered. */
const router = Router();
router.use("/dashboard", dashboardRouter);
router.use("/leads", leadsRouter);
router.use("/quotes", quotesRouter);
router.use("/customers", customersRouter);

export const adminRouter = router;
