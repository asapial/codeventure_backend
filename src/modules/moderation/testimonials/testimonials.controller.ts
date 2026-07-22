import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { IListTestimonialsQuery } from "./testimonials.validation";
import { testimonialsService } from "./testimonials.service";

const listTestimonials = catchAsync(async (req: Request, res: Response) => {
    const result = await testimonialsService.listTestimonials({
        actorUserId: req.user.userId,
        query: req.query as unknown as IListTestimonialsQuery,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Testimonials loaded.",
        data: result,
    });
});

const getTestimonial = catchAsync(async (req: Request, res: Response) => {
    const result = await testimonialsService.getTestimonial({
        actorUserId: req.user.userId,
        testimonialId: String(req.params.id ?? ""),
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Testimonial loaded.",
        data: result,
    });
});

const decideTestimonial = catchAsync(async (req: Request, res: Response) => {
    const result = await testimonialsService.decideTestimonial({
        actorUserId: req.user.userId,
        testimonialId: String(req.params.id ?? ""),
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

export const testimonialsController = {
    listTestimonials,
    getTestimonial,
    decideTestimonial,
};