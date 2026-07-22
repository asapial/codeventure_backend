import { Router } from "express";
import { z } from "zod";

import { validateRequest } from "../../../middleware/validateRequest";
import { portfolioController } from "./portfolio.controller";
import {
    decidePortfolioBodySchema,
    listPortfolioQuerySchema,
} from "./portfolio.validation";

const router = Router();

const listPortfolioValidationSchema = z.object({
    query: listPortfolioQuerySchema,
});

const decidePortfolioValidationSchema = z.object({
    body: decidePortfolioBodySchema,
});

router.get(
    "/",
    validateRequest(listPortfolioValidationSchema),
    portfolioController.listPortfolio,
);

router.get("/:id", portfolioController.getPortfolioCaseStudy);

router.post(
    "/:id/decide",
    validateRequest(decidePortfolioValidationSchema),
    portfolioController.decidePortfolioCaseStudy,
);

export const portfolioRouter = router;