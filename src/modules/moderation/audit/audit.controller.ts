import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { IListAuditQuery } from "./audit.validation";
import { auditService } from "./audit.service";

const listAudit = catchAsync(async (req: Request, res: Response) => {
    const result = await auditService.listAudit({
        actorUserId: req.user.userId,
        query: req.query as unknown as IListAuditQuery,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Audit timeline loaded.",
        data: result,
    });
});

const getAuditBreakdown = catchAsync(async (req: Request, res: Response) => {
    const result = await auditService.getAuditBreakdown({
        actorUserId: req.user.userId,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Audit breakdown loaded.",
        data: result,
    });
});

export const auditController = {
    listAudit,
    getAuditBreakdown,
};