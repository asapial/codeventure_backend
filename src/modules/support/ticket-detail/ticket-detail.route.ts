import { Router } from "express";

import { validateRequest } from "../../../middleware/validateRequest";
import { ticketDetailController } from "./ticket-detail.controller";
import {
    applyMacroSchema,
    escalateSchema,
    patchTicketSchema,
    postMessageSchema,
    postNoteSchema,
    reopenSchema,
    resolveSchema,
    ticketIdParamSchema,
} from "./ticket-detail.validation";

const router = Router();

router.get("/:id", validateRequest(ticketIdParamSchema), ticketDetailController.get);

router.post(
    "/:id/messages",
    validateRequest(postMessageSchema),
    ticketDetailController.postMessage,
);

router.post(
    "/:id/notes",
    validateRequest(postNoteSchema),
    ticketDetailController.postNote,
);

router.post(
    "/:id/macro",
    validateRequest(applyMacroSchema),
    ticketDetailController.applyMacro,
);

router.post(
    "/:id/escalate",
    validateRequest(escalateSchema),
    ticketDetailController.escalate,
);

router.post(
    "/:id/resolve",
    validateRequest(resolveSchema),
    ticketDetailController.resolve,
);

router.post(
    "/:id/reopen",
    validateRequest(reopenSchema),
    ticketDetailController.reopen,
);

router.patch(
    "/:id",
    validateRequest(patchTicketSchema),
    ticketDetailController.patch,
);

export const ticketWorkspaceRouter = router;