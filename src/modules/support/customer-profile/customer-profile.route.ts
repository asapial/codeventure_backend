import { Router } from "express";

import { validateRequest } from "../../../middleware/validateRequest";
import { customerProfileController } from "./customer-profile.controller";
import {
    organizationIdParamSchema,
    profileFlagBodySchema,
    profileNoteBodySchema,
} from "./customer-profile.validation";

const router = Router();

router.get(
    "/:id",
    validateRequest(organizationIdParamSchema),
    customerProfileController.get,
);

router.post(
    "/:id/flag",
    validateRequest(organizationIdParamSchema),
    validateRequest(profileFlagBodySchema),
    customerProfileController.flag,
);

router.post(
    "/:id/notes",
    validateRequest(organizationIdParamSchema),
    validateRequest(profileNoteBodySchema),
    customerProfileController.addNote,
);

export const customerProfileRouter = router;