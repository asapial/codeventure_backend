/**
 * Staff-side Customer Support Console — mounted under `/api/v1/support`.
 *
 * Routes:
 *   S1  /dashboard                      Dashboard KPIs + queues + risk
 *   S2  /inbox                          Ticket inbox (filters, claim)
 *   S3  /tickets/:id                    Ticket workspace (full read/write)
 *   S4  /customers                      Customer search
 *   S5  /customers/:id                  Customer profile (health, notes)
 *   S6  /knowledge                      Knowledge base articles
 *   S7  /reports                        Support reports rollups
 *
 * Authentication: every endpoint requires a valid JWT access token AND a
 * system role of `ADMIN` or `TEACHER` (enforced via `checkAuth(...)`).
 */

import { Router } from "express";

import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../prisma/generated/prisma/enums";

import { dashboardRouter } from "./dashboard/dashboard.route";
import { inboxRouter } from "./inbox/inbox.route";
import { ticketWorkspaceRouter } from "./ticket-detail/ticket-detail.route";
import { customerSearchRouter } from "./customer-search/customer-search.route";
import { customerProfileRouter } from "./customer-profile/customer-profile.route";
import { knowledgeRouter } from "./knowledge/knowledge.route";
import { reportsRouter } from "./reports/reports.route";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.TEACHER));

router.use("/dashboard", dashboardRouter); // S1
router.use("/inbox", inboxRouter); // S2
router.use("/tickets", ticketWorkspaceRouter); // S3
router.use("/customers", customerSearchRouter); // S4
router.use("/customers", customerProfileRouter); // S5
router.use("/knowledge", knowledgeRouter); // S6
router.use("/reports", reportsRouter); // S7

export const supportRouter = router;