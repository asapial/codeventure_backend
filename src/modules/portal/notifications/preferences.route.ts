import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { notificationsController } from "./notifications.controller";
import { updatePreferencesSchema } from "./notifications.validation";

const router = Router();

router.get("/", notificationsController.getPreferences);
router.put(
    "/",
    validateRequest(updatePreferencesSchema),
    notificationsController.updatePreferences,
);

export const notificationPreferencesRouter = router;