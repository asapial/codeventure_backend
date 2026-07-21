/**
 * S7 — Support Reports HTTP handlers.
 *
 * One thin handler per reports tab. Inputs (date range, page, filters)
 * come pre-validated by `validateRequest`.
 */

import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type {
    AuditQuery,
    JobRunQuery,
    LeaderboardQuery,
    ReportsDateRange,
} from "./reports.validation";
import { reportsService } from "./reports.service";

const getKpiRollup = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const query = req.query as unknown as ReportsDateRange;
    const result = await reportsService.getKpiRollup(actorUserId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Reports KPI rollup fetched.",
        data: result,
    });
});

const listEscalations = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const query = req.query as unknown as ReportsDateRange;
    const result = await reportsService.listEscalations(actorUserId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Escalations fetched.",
        data: result,
    });
});

const getLeaderboard = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const query = req.query as unknown as LeaderboardQuery;
    const result = await reportsService.getLeaderboard(actorUserId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Leaderboard fetched.",
        data: result,
    });
});

const getAuditLog = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const query = req.query as unknown as AuditQuery;
    const result = await reportsService.getAuditLog(actorUserId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Audit log fetched.",
        data: result,
    });
});

const getJobRuns = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const query = req.query as unknown as JobRunQuery;
    const result = await reportsService.getJobRuns(actorUserId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Job runs fetched.",
        data: result,
    });
});

const getKnowledgeRollup = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const result = await reportsService.getKnowledgeRollup(actorUserId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Knowledge rollup fetched.",
        data: result,
    });
});

export const reportsController = {
    getKpiRollup,
    listEscalations,
    getLeaderboard,
    getAuditLog,
    getJobRuns,
    getKnowledgeRollup,
};