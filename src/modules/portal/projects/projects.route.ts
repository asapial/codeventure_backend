import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { projectsController } from "./projects.controller";
import { projectListQuerySchema } from "./projects.validation";

const router = Router();

router.get(
    "/",
    validateRequest(projectListQuerySchema),
    projectsController.list,
);

export const projectsRouter = router;