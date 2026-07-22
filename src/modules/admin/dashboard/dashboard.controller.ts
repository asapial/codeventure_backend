import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { dashboardService } from "./dashboard.service";

const getDashboard = catchAsync(async (req: Request, res: Response) => {
    const dashboard = await dashboardService.getAdminDashboard();
    res.status(200).json({ data: dashboard, requestId: req.id });
});

export const dashboardController = { getDashboard };
