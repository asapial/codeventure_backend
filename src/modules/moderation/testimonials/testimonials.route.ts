import { Router } from "express";
import { z } from "zod";

import { validateRequest } from "../../../middleware/validateRequest";
import { testimonialsController } from "./testimonials.controller";
import {
    decideTestimonialBodySchema,
    listTestimonialsQuerySchema,
} from "./testimonials.validation";

const router = Router();

const listTestimonialsValidationSchema = z.object({
    query: listTestimonialsQuerySchema,
});

const decideTestimonialValidationSchema = z.object({
    body: decideTestimonialBodySchema,
});

router.get(
    "/",
    validateRequest(listTestimonialsValidationSchema),
    testimonialsController.listTestimonials,
);

router.get("/:id", testimonialsController.getTestimonial);

router.post(
    "/:id/decide",
    validateRequest(decideTestimonialValidationSchema),
    testimonialsController.decideTestimonial,
);

export const testimonialsRouter = router;