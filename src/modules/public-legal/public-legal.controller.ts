// Public legal document controller (P21).
// Thin wrapper around the service — validates the slug param and returns the
// document body wrapped in the standard `{ data, meta }` envelope.

import { publicLegalService } from "./public-legal.service.js";
import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";

const getLegalDocument = catchAsync(async (req: Request, res: Response) => {
    const { slug } = req.params as { slug: string };
    const document = await publicLegalService.getLegalDocumentBySlug(slug);

    sendResponse(res, {
        status: 200,
        success: true,
        message: "Legal document fetched.",
        data: document,
    });
});

export const publicLegalController = {
    getLegalDocument,
};
