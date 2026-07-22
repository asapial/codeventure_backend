import { Router } from "express";
import { z } from "zod";

import { validateRequest } from "../../../middleware/validateRequest";
import { auditController } from "./audit.controller";
import { listAuditQuerySchema } from "./audit.validation";

const router = Router();

const listAuditValidationSchema = z.object({ query: listAuditQuerySchema });

router.get(
    "/",
    validateRequest(listAuditValidationSchema),
    auditController.listAudit,
);

router.get("/breakdown", auditController.getAuditBreakdown);

export const auditRouter = router;