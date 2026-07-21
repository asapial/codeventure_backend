import { Router } from "express";

import { validateRequest } from "../../../middleware/validateRequest";
import { inboxController } from "./inbox.controller";
import {
    claimTicketSchema,
    inboxListQuerySchema,
} from "./inbox.validation";

const router = Router();

router.get("/", validateRequest(inboxListQuerySchema), inboxController.list);
router.post(
    "/:ticketId/claim",
    validateRequest(claimTicketSchema),
    inboxController.claim,
);

export const inboxRouter = router;
