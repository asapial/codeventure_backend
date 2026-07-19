import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { settingsService } from "./settings.service";
import type {
    ExportRequestBody,
    InviteTeamBody,
    PatchOrganizationBody,
    PatchProfileBody,
    UpdateMemberBody,
} from "./settings.validation";

const get = catchAsync(async (req: Request, res: Response) => {
    const result = await settingsService.getSettings(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Settings retrieved.",
        data: result,
    });
});

const patchProfile = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as PatchProfileBody;
    const result = await settingsService.patchProfile(req.user.userId, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Profile updated.",
        data: result,
    });
});

const patchOrganization = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const body = req.body as PatchOrganizationBody;
    const result = await settingsService.patchOrganization(
        req.user.userId,
        body,
        slug,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Organization updated.",
        data: result,
    });
});

const inviteTeam = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const body = req.body as InviteTeamBody;
    const result = await settingsService.inviteTeamMember(
        req.user.userId,
        slug,
        body,
    );
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Invitation sent.",
        data: result,
    });
});

const updateMember = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as UpdateMemberBody;
    const result = await settingsService.updateMember(
        req.user.userId,
        id,
        body,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Member updated.",
        data: result,
    });
});

const removeMember = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await settingsService.removeMember(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Member removed.",
        data: { id },
    });
});

const revokeSession = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await settingsService.revokeSession(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Session revoked.",
        data: { id },
    });
});

const requestExport = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as ExportRequestBody;
    const result = await settingsService.requestExport(req.user.userId, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Data export queued.",
        data: result,
    });
});

export const settingsController = {
    get,
    patchProfile,
    patchOrganization,
    inviteTeam,
    updateMember,
    removeMember,
    revokeSession,
    requestExport,
};