import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { authTwoFactorController } from "./auth-2fa.controller";
import {
    twoFactorVerifySchema,
    twoFactorResendSchema,
} from "./auth-2fa.validation";

const router = Router();

router.post(
    "/verify",
    validateRequest(twoFactorVerifySchema),
    authTwoFactorController.verify,
);
router.post(
    "/resend",
    validateRequest(twoFactorResendSchema),
    authTwoFactorController.resend,
);

export const authTwoFactorRouter = router;