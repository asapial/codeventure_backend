import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { ClaimTicketBody, ClaimTicketParams, InboxListQuery } from "./inbox.validation";
import { inboxService } from "./inbox.service";

const list = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as InboxListQuery;
    const result = await inboxService.list(query, req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Inbox ready.",
        data: result,
    });
});

const claim = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as unknown as ClaimTicketParams;
    const body = (req.body ?? {}) as ClaimTicketBody;
    const result = await inboxService.claim(
        params.ticketId,
        req.user.userId,
        body?.reason,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Ticket claimed.",
        data: result,
    });
});

export const inboxController = { list, claim };
