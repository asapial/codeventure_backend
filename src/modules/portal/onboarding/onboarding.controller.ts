import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { onboardingService } from "./onboarding.service";
import type {
    InvitationBody,
    UpdateOnboardingBody,
} from "./onboarding.validation";

const getOnboarding = catchAsync(async (req: Request, res: Response) => {
    const profile = await onboardingService.getOnboarding(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Onboarding profile retrieved successfully.",
        data: profile,
    });
});

const updateOnboarding = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as UpdateOnboardingBody;
    const profile = await onboardingService.updateOnboarding(req.user.userId, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Onboarding profile updated successfully.",
        data: profile,
    });
});

const invite = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as InvitationBody;
    const invitation = await onboardingService.invite(req.user.userId, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Invitation created successfully.",
        data: invitation,
    });
});

export const onboardingController = {
    getOnboarding,
    updateOnboarding,
    invite,
};
