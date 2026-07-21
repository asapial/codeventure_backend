/**
 * S6 — Knowledge Base router.
 *
 * Per-endpoint Zod validation is applied here; agent role enforcement
 * happens at the aggregator (`support.route.ts`) so this router only
 * needs to declare its routes.
 */

import { Router } from "express";

import { validateRequest } from "../../../middleware/validateRequest";
import { knowledgeController } from "./knowledge.controller";
import {
    articleIdParamSchema,
    changeArticleStatusBodySchema,
    createArticleBodySchema,
    knowledgeListQuerySchema,
    replyFeedbackBodySchema,
    updateArticleBodySchema,
} from "./knowledge.validation";

const router = Router();

router.get(
    "/",
    validateRequest(knowledgeListQuerySchema),
    knowledgeController.listArticles,
);

router.get(
    "/:id",
    validateRequest(articleIdParamSchema),
    knowledgeController.getArticle,
);

router.post(
    "/",
    validateRequest(createArticleBodySchema),
    knowledgeController.createArticle,
);

router.patch(
    "/:id",
    validateRequest(articleIdParamSchema),
    validateRequest(updateArticleBodySchema),
    knowledgeController.updateArticle,
);

router.patch(
    "/:id/status",
    validateRequest(articleIdParamSchema),
    validateRequest(changeArticleStatusBodySchema),
    knowledgeController.changeArticleStatus,
);

router.post(
    "/:id/archive",
    validateRequest(articleIdParamSchema),
    knowledgeController.archiveArticle,
);

router.post(
    "/:id/reply",
    validateRequest(articleIdParamSchema),
    validateRequest(replyFeedbackBodySchema),
    knowledgeController.replyFeedback,
);

export const knowledgeRouter = router;