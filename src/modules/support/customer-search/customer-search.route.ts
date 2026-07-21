import { Router } from "express";

import { validateRequest } from "../../../middleware/validateRequest";
import { customerSearchController } from "./customer-search.controller";
import { customerSearchQuerySchema } from "./customer-search.validation";

const router = Router();

router.get(
    "/",
    validateRequest(customerSearchQuerySchema),
    customerSearchController.search,
);

export const customerSearchRouter = router;