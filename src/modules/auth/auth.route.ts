import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { authController } from "./auth.controller";
import {
    signInSchema,
    signUpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from "./auth.validation";

const router = Router();

router.post("/sign-in", validateRequest(signInSchema), authController.signIn);
router.post("/sign-up", validateRequest(signUpSchema), authController.signUp);
router.post("/sign-out", authController.signOut);
router.get("/session", authController.session);
router.post(
    "/forgot-password",
    validateRequest(forgotPasswordSchema),
    authController.forgotPassword,
);
router.post(
    "/reset-password",
    validateRequest(resetPasswordSchema),
    authController.resetPassword,
);

export const authRouter = router;
