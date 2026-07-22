import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { IListPortfolioQuery } from "./portfolio.validation";
import { portfolioService } from "./portfolio.service";

const listPortfolio = catchAsync(async (req: Request, res: Response) => {
    const result = await portfolioService.listPortfolio({
        actorUserId: req.user.userId,
        query: req.query as unknown as IListPortfolioQuery,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Portfolio case studies loaded.",
        data: result,
    });
});

const getPortfolioCaseStudy = catchAsync(
    async (req: Request, res: Response) => {
        const result = await portfolioService.getPortfolioCaseStudy({
            actorUserId: req.user.userId,
            caseStudyId: String(req.params.id ?? ""),
        });
        sendResponse(res, {
            status: status.OK,
            success: true,
            message: "Portfolio case study loaded.",
            data: result,
        });
    },
);

const decidePortfolioCaseStudy = catchAsync(
    async (req: Request, res: Response) => {
        const result = await portfolioService.decidePortfolioCaseStudy({
            actorUserId: req.user.userId,
            caseStudyId: String(req.params.id ?? ""),
            body: req.body,
        });
        sendResponse(res, {
            status: status.OK,
            success: true,
            message: result.idempotentReplay
                ? "Decision replayed."
                : "Decision recorded.",
            data: result,
        });
    },
);

export const portfolioController = {
    listPortfolio,
    getPortfolioCaseStudy,
    decidePortfolioCaseStudy,
};