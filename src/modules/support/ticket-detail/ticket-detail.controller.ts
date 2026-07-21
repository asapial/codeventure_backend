import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type {
    ApplyMacroBody,
    EscalateBody,
    PatchTicketBody,
    PostMessageBody,
    PostNoteBody,
    ReopenBody,
    ResolveBody,
} from "./ticket-detail.validation";
import { ticketDetailService } from "./ticket-detail.service";

const get = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ticketDetailService.getDetail(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Ticket workspace ready.",
        data: result,
    });
});

const postMessage = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as PostMessageBody;
    const result = await ticketDetailService.postMessage(req.user.userId, id, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Message posted.",
        data: result,
    });
});

const postNote = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as PostNoteBody;
    const result = await ticketDetailService.postNote(req.user.userId, id, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Internal note added.",
        data: result,
    });
});

const applyMacro = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as ApplyMacroBody;
    const result = await ticketDetailService.applyMacro(req.user.userId, id, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Macro applied.",
        data: result,
    });
});

const escalate = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as EscalateBody;
    const result = await ticketDetailService.escalate(req.user.userId, id, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Ticket escalated.",
        data: result,
    });
});

const resolveTicket = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as ResolveBody;
    const result = await ticketDetailService.resolve(req.user.userId, id, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Ticket resolved.",
        data: result,
    });
});

const reopen = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = (req.body ?? undefined) as ReopenBody | undefined;
    const result = await ticketDetailService.reopen(req.user.userId, id, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Ticket reopened.",
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
        message: "Ticket updated.",
        data: result,
    });
});

export const ticketDetailController = {
    get,
    postMessage,
    postNote,
    applyMacro,
    escalate,
    resolve: resolveTicket,
    reopen,
    patch,
};