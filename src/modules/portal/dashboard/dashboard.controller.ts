import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { dashboardService } from "./dashboard.service";

const getDashboard = catchAsync(async (req: Request, res: Response) => {
    const dashboard = await dashboardService.getDashboard(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Customer dashboard retrieved successfully.",
        data: dashboard,
    });
});

export const dashboardController = { getDashboard };
