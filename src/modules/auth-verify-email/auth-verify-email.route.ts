import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { authVerifyEmailController } from "./auth-verify-email.controller";
import {
    verifyEmailSchema,
    resendVerificationSchema,
} from "./auth-verify-email.validation";

const router = Router();

router.post(
    "/",
    validateRequest(verifyEmailSchema),
    authVerifyEmailController.verify,
);
router.post(
    "/resend",
    validateRequest(resendVerificationSchema),
    authVerifyEmailController.resend,
);

export const authVerifyEmailRouter = router;