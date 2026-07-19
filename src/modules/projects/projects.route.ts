import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { projectsController } from "./projects.controller";
import {
    projectListQuerySchema,
    projectSlugParamSchema,
} from "./projects.validation";

const router = Router();

router.get(
    "/",
    checkAuth(),
    validateRequest(projectListQuerySchema),
    projectsController.list,
);

router.get(
    "/:slug",
    checkAuth(),
    validateRequest(projectSlugParamSchema),
    projectsController.getBySlug,
);

export const projectsRouter = router;
