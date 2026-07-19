import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { notificationsController } from "./notifications.controller";
import {
    listQuerySchema,
    markReadParamSchema,
    updatePreferencesSchema,
} from "./notifications.validation";

const router = Router();

router.get("/", validateRequest(listQuerySchema), notificationsController.list);
router.patch(
    "/:id/read",
    validateRequest(markReadParamSchema),
    notificationsController.markRead,
);
router.post("/read-all", notificationsController.markAllRead);

export const notificationsRouter = router;