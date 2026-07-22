import { Router } from "express";
import { z } from "zod";

import { validateRequest } from "../../../middleware/validateRequest";
import { blogController } from "./blog.controller";
import {
    decideBlogBodySchema,
    listBlogQuerySchema,
} from "./blog.validation";

const router = Router();

const listBlogValidationSchema = z.object({
    query: listBlogQuerySchema,
});

const decideBlogValidationSchema = z.object({
    body: decideBlogBodySchema,
});

router.get(
    "/",
    validateRequest(listBlogValidationSchema),
    blogController.listBlog,
);

router.get("/:id", blogController.getBlogPost);

router.post(
    "/:id/decide",
    validateRequest(decideBlogValidationSchema),
    blogController.decideBlogPost,
);

export const blogRouter = router;