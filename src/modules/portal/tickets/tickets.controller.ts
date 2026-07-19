import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { ticketsService } from "./tickets.service";
import type {
    CreateTicketBody,
    HelpSearchQuery,
    TicketListQuery,
} from "./tickets.validation";

const list = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as TicketListQuery;
    const result = await ticketsService.list(req.user.userId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Tickets retrieved.",
        data: result,
    });
});

const create = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CreateTicketBody;
    const result = await ticketsService.create(req.user.userId, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Ticket created.",
        data: result,
    });
});

const searchHelp = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as HelpSearchQuery;
    const result = await ticketsService.searchHelp(req.user.userId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Help articles retrieved.",
        data: result,
    });
});

export const ticketsController = { list, create, searchHelp };