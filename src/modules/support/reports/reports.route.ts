/**
 * S7 — Support Reports router.
 *
 * One route per reports tab: KPIs, escalations, leaderboard, audit log,
 * job runs, knowledge rollup. Agent-role enforcement happens at the
 * aggregator (`support.route.ts`), so this router only declares its
 * endpoints + per-route validation.
 */

import { Router } from "express";

import { validateRequest } from "../../../middleware/validateRequest";
import { reportsController } from "./reports.controller";
import {
    auditQuerySchema,
    jobRunQuerySchema,
    leaderboardQuerySchema,
    reportsDateRangeSchema,
} from "./reports.validation";

const router = Router();

router.get(
    "/kpis",
    validateRequest(reportsDateRangeSchema),
    reportsController.getKpiRollup,
);

router.get(
    "/escalations",
    validateRequest(reportsDateRangeSchema),
    reportsController.listEscalations,
);

router.get(
    "/leaderboard",
    validateRequest(leaderboardQuerySchema),
    reportsController.getLeaderboard,
);

router.get(
    "/audit",
    validateRequest(auditQuerySchema),
    reportsController.getAuditLog,
);

router.get(
    "/jobs",
    validateRequest(jobRunQuerySchema),
    reportsController.getJobRuns,
);

router.get(
    "/knowledge",
    reportsController.getKnowledgeRollup,
);

export const reportsRouter = router;