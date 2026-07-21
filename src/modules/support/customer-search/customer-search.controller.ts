import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { CustomerSearchQuery } from "./customer-search.validation";
import { customerSearchService } from "./customer-search.service";

const search = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as CustomerSearchQuery;
    const result = await customerSearchService.search(req.user.userId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Customer search ready.",
        data: result,
    });
});

export const customerSearchController = { search };