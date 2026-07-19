import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authService } from "./auth.service";

const signIn = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.signIn(res, req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Signed in successfully.",
        data: result,
    });
});

const signUp = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.signUp(res, req.body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Account created successfully.",
        data: result,
    });
});

const signOut = catchAsync(async (req: Request, res: Response) => {
    await authService.signOut(res);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Signed out successfully.",
        data: null,
    });
});

const session = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.getSession(req);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: result ? "Session active." : "No active session.",
        data: result,
    });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "If an account exists for that email, a reset link has been sent.",
        data: { reference: req.id ?? "request-received" },
    });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Password reset successfully. You can now sign in.",
        data: { ok: true },
    });
});

export const authController = {
    signIn,
    signUp,
    signOut,
    session,
    forgotPassword,
    resetPassword,
};
