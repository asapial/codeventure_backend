import { Router } from "express";
import { authRouter } from "./modules/auth/auth.route.js";
import { accountRouter } from "./modules/account/account.route.js";
import { projectsRouter } from "./modules/projects/projects.route.js";
import { authTwoFactorRouter } from "./modules/auth-2fa/auth-2fa.route.js";
import { authRegisterRouter } from "./modules/auth-register/auth-register.route.js";
import { authVerifyEmailRouter } from "./modules/auth-verify-email/auth-verify-email.route.js";
import { publicLegalRouter } from "./modules/public-legal/public-legal.route.js";
import { portalRouter } from "./modules/portal/portal.route.js";

const router = Router();

router.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "v1 ok" });
});

router.use("/auth", authRouter);
// Mount P16-P18 auth sub-modules under /auth so the URL tree is shallow
// (e.g. POST /api/v1/auth/2fa/verify instead of /api/v1/auth-2fa/verify).
router.use("/auth/2fa", authTwoFactorRouter);
router.use("/auth/register", authRegisterRouter);
router.use("/auth/verify-email", authVerifyEmailRouter);
router.use("/account", accountRouter);
router.use("/projects", projectsRouter);
// Customer portal (C1â€"C10) â€” mounts every authenticated workspace endpoint.
router.use("/customer", portalRouter);
// Public legal document endpoint â€" intentionally unauthenticated.
router.use("/public/legal", publicLegalRouter);

export const indexRouter = router;