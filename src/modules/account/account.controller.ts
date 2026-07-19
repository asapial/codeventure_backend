import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { accountService } from "./account.service";

const getSummary = catchAsync(async (req: Request, res: Response) => {
    const summary = await accountService.getSummary(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Account summary retrieved successfully.",
        data: summary,
    });
});

export const accountController = { getSummary };
