import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { IListReviewsQuery } from "./reviews.validation";
import { reviewsService } from "./reviews.service";

const listReviews = catchAsync(async (req: Request, res: Response) => {
    const result = await reviewsService.listReviews({
        actorUserId: req.user.userId,
        query: req.query as unknown as IListReviewsQuery,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Review queue loaded.",
        data: result,
    });
});

const getReview = catchAsync(async (req: Request, res: Response) => {
    const result = await reviewsService.getReview({
        actorUserId: req.user.userId,
        reviewId: String(req.params.id ?? ""),
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Review loaded.",
        data: result,
    });
});

const decideReview = catchAsync(async (req: Request, res: Response) => {
    const result = await reviewsService.decideReview({
        actorUserId: req.user.userId,
        reviewId: String(req.params.id ?? ""),
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
});

export const reviewsController = {
    listReviews,
    getReview,
    decideReview,
};