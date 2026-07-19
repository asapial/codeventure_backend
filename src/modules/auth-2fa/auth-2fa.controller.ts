import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import {
    verifyChallenge,
    resendChallenge,
} from "./auth-2fa.service";

const verify = catchAsync(async (req: Request, res: Response) => {
    const result = await verifyChallenge(res, req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Two-factor verified.",
        data: result,
    });
});

const resend = catchAsync(async (req: Request, res: Response) => {
    const result = await resendChallenge(req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "If the challenge is still valid, a new code has been sent.",
        data: result,
    });
});

export const authTwoFactorController = { verify, resend };