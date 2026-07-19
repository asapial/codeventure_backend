import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { ticketDetailService } from "./ticket-detail.service";
import type { PatchTicketBody, PostMessageBody } from "./ticket-detail.validation";

const get = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ticketDetailService.getDetail(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Ticket detail retrieved.",
        data: result,
    });
});

const postMessage = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as PostMessageBody;
    const result = await ticketDetailService.postMessage(
        req.user.userId,
        id,
        body,
    );
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Message posted.",
        data: result,
    });
});

const patch = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as PatchTicketBody;
    const result = await ticketDetailService.patch(req.user.userId, id, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: body.action === "close" ? "Ticket closed." : "Ticket reopened.",
        data: result,
    });
});

export const ticketDetailController = { get, postMessage, patch };