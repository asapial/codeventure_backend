import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { authRegisterController } from "./auth-register.controller";
import {
    registerSchema,
    acceptInvitationSchema,
} from "./auth-register.validation";

const router = Router();

router.post(
    "/",
    validateRequest(registerSchema),
    authRegisterController.register,
);
router.post(
    "/invitations/accept",
    validateRequest(acceptInvitationSchema),
    authRegisterController.acceptInvitation,
);

export const authRegisterRouter = router;