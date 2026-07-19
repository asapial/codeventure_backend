import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { ticketDetailController } from "./ticket-detail.controller";
import {
    patchTicketSchema,
    postMessageSchema,
    ticketIdParamSchema,
} from "./ticket-detail.validation";

const router = Router();

router.get(
    "/:id",
    validateRequest(ticketIdParamSchema),
    ticketDetailController.get,
);
router.post(
    "/:id/messages",
    validateRequest(postMessageSchema),
    ticketDetailController.postMessage,
);
router.patch(
    "/:id",
    validateRequest(patchTicketSchema),
    ticketDetailController.patch,
);

export const ticketDetailRouter = router;