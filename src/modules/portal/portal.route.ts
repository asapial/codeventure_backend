import { Router } from "express";

import { checkAuth } from "../../middleware/checkAuth";

import { dashboardRouter } from "./dashboard/dashboard.route";
import { onboardingRouter } from "./onboarding/onboarding.route";
import { projectsRouter } from "./projects/projects.route";
import { projectDetailRouter } from "./project-detail/project-detail.route";
import { maintenanceRouter } from "./maintenance/maintenance.route";
import { billingRouter } from "./billing/billing.route";
import { ticketsRouter } from "./tickets/tickets.route";
import { ticketDetailRouter } from "./ticket-detail/ticket-detail.route";
import { notificationsRouter } from "./notifications/notifications.route";
import { settingsRouter } from "./settings/settings.route";

/**
 * Customer portal root router — mounted under `/api/v1/customer`.
 *
 * Every endpoint behind this router requires a valid JWT access token. The
 * checkAuth() call deliberately accepts no `Role` argument so all four
 * account roles (OWNER/ADMIN/EDITOR/VIEWER) can reach the portal; finer-grained
 * per-endpoint capability gates are enforced inside each controller via
 * `requireOrgMembership` / `requireCustomerOwner`.
 *
 * Spec sections → endpoints:
 *   C1   /dashboard
 *   C2   /onboarding, /team/invitations
 *   C3   /projects
 *   C4   /projects/:id (activity, comments, files, approvals, change-requests)
 *   C5   /maintenance (overview, requests, reports)
 *   C6   /billing (overview, contracts, invoices, payment)
 *   C7   /tickets, /help/search
 *   C8   /tickets/:id (messages, status)
 *   C9   /notifications, /notification-preferences
 *   C10  /settings (profile, organization, team, sessions, data-export)
 */
const router = Router();

router.use(checkAuth());

router.use("/dashboard", dashboardRouter);
router.use("/onboarding", onboardingRouter);
router.use("/projects", projectsRouter);
router.use("/projects", projectDetailRouter); // /projects/:id is declared here
router.use("/maintenance", maintenanceRouter);
router.use("/billing", billingRouter);
router.use("/tickets", ticketsRouter);
router.use("/tickets", ticketDetailRouter); // /tickets/:id is declared here
router.use("/notifications", notificationsRouter);
router.use("/notification-preferences", notificationsRouter); // alias for C9
router.use("/settings", settingsRouter);

export const portalRouter = router;
