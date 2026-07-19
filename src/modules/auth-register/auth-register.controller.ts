import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { register, acceptInvitation } from "./auth-register.service";

const registerController = catchAsync(async (req: Request, res: Response) => {
    const result = await register(req.body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Account created. Check your inbox to verify your email.",
        data: result,
    });
});

const acceptInvitationController = catchAsync(async (req: Request, res: Response) => {
    const result = await acceptInvitation(req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Invitation accepted. You can now sign in.",
        data: result,
    });
});

export const authRegisterController = {
    register: registerController,
    acceptInvitation: acceptInvitationController,
};