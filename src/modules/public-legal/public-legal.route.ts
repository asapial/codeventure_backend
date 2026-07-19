// Public legal document routes (P21).
//
// All routes in this router are public — no `checkAuth(...)` middleware. They
// are mounted under `/public/legal` in `src/index.ts`.

import { Router } from "express";
import { publicLegalController } from "./public-legal.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { getLegalDocumentSchema } from "./public-legal.validation.js";

const router = Router();

// GET /public/legal/:slug
// Returns the published version of the legal document identified by `slug`.
// 404 if the document does not exist or has not been published yet.
router.get(
    "/:slug",
    validateRequest(getLegalDocumentSchema),
    publicLegalController.getLegalDocument,
);

export const publicLegalRouter = router;
