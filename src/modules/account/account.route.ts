import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { accountController } from "./account.controller";

const router = Router();

router.get("/summary", checkAuth(), accountController.getSummary);

export const accountRouter = router;
