import { Router } from "express";
import { authRouter } from "./modules/auth/auth.route";
import { accountRouter } from "./modules/account/account.route";
import { projectsRouter } from "./modules/projects/projects.route";

const router = Router();

router.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "v1 ok" });
});

router.use("/auth", authRouter);
router.use("/account", accountRouter);
router.use("/projects", projectsRouter);

export const indexRouter = router;