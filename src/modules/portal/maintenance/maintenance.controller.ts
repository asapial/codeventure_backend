import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { maintenanceService } from "./maintenance.service";
import type { SubmitMaintenanceRequestBody } from "./maintenance.validation";

const get = catchAsync(async (req: Request, res: Response) => {
    const result = await maintenanceService.getMaintenance(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Maintenance retrieved.",
        data: result,
    });
});

const submit = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as SubmitMaintenanceRequestBody;
    const result = await maintenanceService.submitRequest(req.user.userId, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Maintenance request submitted.",
        data: result,
    });
});

export const maintenanceController = { get, submit };