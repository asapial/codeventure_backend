import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { onboardingController } from "./onboarding.controller";
import {
    invitationBodySchema,
    updateOnboardingBodySchema,
} from "./onboarding.validation";

const router = Router();

router.get("/", onboardingController.getOnboarding);
router.put(
    "/",
    validateRequest(updateOnboardingBodySchema),
    onboardingController.updateOnboarding,
);
router.post(
    "/team/invitations",
    validateRequest(invitationBodySchema),
    onboardingController.invite,
);

export const onboardingRouter = router;
