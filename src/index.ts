import { Router } from "express";
import { accountRouter } from "./modules/account/account.route.js";
import { adminRouter } from "./modules/admin/admin.route.js";
import { authTwoFactorRouter } from "./modules/auth-2fa/auth-2fa.route.js";
import { authRegisterRouter } from "./modules/auth-register/auth-register.route.js";
import { authVerifyEmailRouter } from "./modules/auth-verify-email/auth-verify-email.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { moderationRouter } from "./modules/moderation/moderation.route.js";
import { portalRouter } from "./modules/portal/portal.route.js";
import { projectsRouter } from "./modules/projects/projects.route.js";
import { publicLegalRouter } from "./modules/public-legal/public-legal.route.js";
import { supportRouter } from "./modules/support/support.route.js";

const router = Router();
router.get("/health", (_req, res) => res.status(200).json({ success: true, message: "v1 ok" }));
router.use("/auth", authRouter);
router.use("/auth/2fa", authTwoFactorRouter);
router.use("/auth/register", authRegisterRouter);
router.use("/auth/verify-email", authVerifyEmailRouter);
router.use("/account", accountRouter);
router.use("/projects", projectsRouter);
router.use("/customer", portalRouter);
router.use("/support", supportRouter);
router.use("/moderation", moderationRouter);
router.use("/admin", adminRouter);
router.use("/public/legal", publicLegalRouter);

export const indexRouter = router;
