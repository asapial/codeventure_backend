import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { IListMediaQuery } from "./media.validation";
import { mediaService } from "./media.service";

const listMedia = catchAsync(async (req: Request, res: Response) => {
    const result = await mediaService.listMedia({
        actorUserId: req.user.userId,
        query: req.query as unknown as IListMediaQuery,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Media scans loaded.",
        data: result,
    });
});

const getMediaAsset = catchAsync(async (req: Request, res: Response) => {
    const result = await mediaService.getMediaAsset({
        actorUserId: req.user.userId,
        scanId: String(req.params.id ?? ""),
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Media scan loaded.",
        data: result,
    });
});

const quarantineMedia = catchAsync(async (req: Request, res: Response) => {
    const result = await mediaService.quarantineMedia({
        actorUserId: req.user.userId,
        scanId: String(req.params.id ?? ""),
        body: req.body,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Media quarantined.",
        data: result,
    });
});

const clearMedia = catchAsync(async (req: Request, res: Response) => {
    const result = await mediaService.clearMedia({
        actorUserId: req.user.userId,
        scanId: String(req.params.id ?? ""),
        body: req.body,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Media cleared.",
        data: result,
    });
});

export const mediaController = {
    listMedia,
    getMediaAsset,
    quarantineMedia,
    clearMedia,
};
