import { Router } from "express";
import { z } from "zod";

import { validateRequest } from "../../../middleware/validateRequest";
import { reviewsController } from "./reviews.controller";
import {
    decideReviewBodySchema,
    listReviewsQuerySchema,
} from "./reviews.validation";

const router = Router();

const listReviewsValidationSchema = z.object({
    query: listReviewsQuerySchema,
});

const decideReviewValidationSchema = z.object({
    body: decideReviewBodySchema,
});

router.get(
    "/",
    validateRequest(listReviewsValidationSchema),
    reviewsController.listReviews,
);

router.get("/:id", reviewsController.getReview);

router.post(
    "/:id/decide",
    validateRequest(decideReviewValidationSchema),
    reviewsController.decideReview,
);

export const reviewsRouter = router;