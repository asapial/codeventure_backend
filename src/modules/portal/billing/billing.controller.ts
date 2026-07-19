import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { billingService } from "./billing.service";
import type { PayInvoiceBody } from "./billing.validation";

const get = catchAsync(async (req: Request, res: Response) => {
    const result = await billingService.getBilling(req.user.userId);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Billing retrieved.",
        data: result,
    });
});

const getInvoice = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await billingService.getInvoiceDetail(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Invoice retrieved.",
        data: result,
    });
});

const getContractPdf = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await billingService.getContractPdf(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Contract PDF located.",
        data: result,
    });
});

const getInvoicePdf = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await billingService.getInvoicePdf(req.user.userId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Invoice PDF located.",
        data: result,
    });
});

const payInvoice = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as PayInvoiceBody;
    const result = await billingService.payInvoice(
        req.user.userId,
        id,
        body,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: result.idempotent
            ? "Payment already processed."
            : "Payment processed.",
        data: result,
    });
});

export const billingController = {
    get,
    getInvoice,
    getContractPdf,
    getInvoicePdf,
    payInvoice,
};