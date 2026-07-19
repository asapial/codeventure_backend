import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { ticketsController } from "../tickets/tickets.controller";
import { helpSearchSchema } from "../tickets/tickets.validation";

const router = Router();

router.get("/search", validateRequest(helpSearchSchema), ticketsController.searchHelp);

export const helpRouter = router;