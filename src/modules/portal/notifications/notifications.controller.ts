import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { notificationsService } from "./notifications.service";
import type {
    ListNotificationsQuery,
    UpdatePreferencesBody,
} from "./notifications.validation";

const list = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListNotificationsQuery;
    const result = await notificationsService.list(req.user.userId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Notifications retrieved.",
        data: result,
    });
});

const markRead = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await notificationsService.markRead(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Notification marked read.",
        data: result,
    });
});

const markAllRead = catchAsync(async (req: Request, res: Response) => {
    const result = await notificationsService.markAllRead(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "All notifications marked read.",
        data: result,
    });
});

const getPreferences = catchAsync(async (req: Request, res: Response) => {
    const result = await notificationsService.getPreferences(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Preferences retrieved.",
        data: result,
    });
});

const updatePreferences = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as UpdatePreferencesBody;
    const result = await notificationsService.updatePreferences(
        req.user.userId,
        body,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Preferences updated.",
        data: result,
    });
});

export const notificationsController = {
    list,
    markRead,
    markAllRead,
    getPreferences,
    updatePreferences,
};