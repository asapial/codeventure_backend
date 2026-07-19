import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { ticketsController } from "./tickets.controller";
import {
    createTicketSchema,
    helpSearchSchema,
    ticketListQuerySchema,
} from "./tickets.validation";

const router = Router();

router.get("/", validateRequest(ticketListQuerySchema), ticketsController.list);
router.post("/", validateRequest(createTicketSchema), ticketsController.create);

export const ticketsRouter = router;