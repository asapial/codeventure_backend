import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type {
    OrganizationIdParam,
    ProfileFlagBody,
    ProfileNoteBody,
} from "./customer-profile.validation";
import { customerProfileService } from "./customer-profile.service";

const get = catchAsync(async (req: Request, res: Response) => {
    const param = req.params as unknown as OrganizationIdParam;
    const result = await customerProfileService.getProfile(
        req.user.userId,
        param,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Customer profile ready.",
        data: result,
    });
});

const flag = catchAsync(async (req: Request, res: Response) => {
    const param = req.params as unknown as OrganizationIdParam;
    const body = req.body as ProfileFlagBody;
    const result = await customerProfileService.flagProfile(
        req.user.userId,
        param,
        body,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Customer flag updated.",
        data: result,
    });
});

const addNote = catchAsync(async (req: Request, res: Response) => {
    const param = req.params as unknown as OrganizationIdParam;
    const body = req.body as ProfileNoteBody;
    const result = await customerProfileService.addNote(
        req.user.userId,
        param,
        body,
    );
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Activity note added.",
        data: result,
    });
});

export const customerProfileController = { get, flag, addNote };