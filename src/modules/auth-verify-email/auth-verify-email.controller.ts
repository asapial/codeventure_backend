import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import {
    verifyEmail,
    resendVerificationCode,
} from "./auth-verify-email.service";

const verify = catchAsync(async (req: Request, res: Response) => {
    const result = await verifyEmail(req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Email verified successfully.",
        data: result,
    });
});

const resend = catchAsync(async (req: Request, res: Response) => {
    const result = await resendVerificationCode(req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "If the email is pending verification, a new code has been sent.",
        data: result,
    });
});

export const authVerifyEmailController = { verify, resend };