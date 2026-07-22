import { Router } from "express";
import { z } from "zod";

import { validateRequest } from "../../../middleware/validateRequest";
import { mediaController } from "./media.controller";
import {
    listMediaQuerySchema,
    mediaActionBodySchema,
} from "./media.validation";

const router = Router();

const listMediaValidationSchema = z.object({ query: listMediaQuerySchema });
const actionValidationSchema = z.object({ body: mediaActionBodySchema });

router.get(
    "/",
    validateRequest(listMediaValidationSchema),
    mediaController.listMedia,
);

router.get("/:id", mediaController.getMediaAsset);

router.post(
    "/:id/quarantine",
    validateRequest(actionValidationSchema),
    mediaController.quarantineMedia,
);

router.post(
    "/:id/clear",
    validateRequest(actionValidationSchema),
    mediaController.clearMedia,
);

export const mediaRouter = router;
