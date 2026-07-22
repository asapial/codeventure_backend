import { Router } from "express";
import { dashboardRouter } from "./dashboard/dashboard.route.js";
import { leadsRouter } from "./leads/leads.route.js";
import { quotesRouter } from "./quotes/quotes.route.js";
import { customersRouter } from "./customers/customers.route.js";
import { adminProjectsRouter } from "./projects/projects.route.js";
import { catalogRouter } from "./catalog/catalog.route.js";
import { billingRouter } from "./billing/billing.route.js";
import { teamRouter } from "./team/team.route.js";
import { contentRouter } from "./content/content.route.js";
import { analyticsRouter } from "./analytics/analytics.route.js";

/** A1-A22 feature routers are mounted here as they are delivered. */
const router = Router();
router.use("/dashboard", dashboardRouter);
router.use("/leads", leadsRouter);
router.use("/quotes", quotesRouter);
router.use("/customers", customersRouter);
router.use("/projects", adminProjectsRouter);
router.use(catalogRouter);
router.use(billingRouter);
router.use(teamRouter);
router.use(contentRouter);
router.use(analyticsRouter);

export const adminRouter = router;
