import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { dashboardService } from "./dashboard.service";

const getDashboard = catchAsync(async (req: Request, res: Response) => {
    const result = await dashboardService.getDashboard(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Support dashboard ready.",
        data: result,
    });
});

export const dashboardController = { getDashboard };