import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { billingController } from "./billing.controller";
import {
    contractIdParamSchema,
    invoiceIdParamSchema,
    payInvoiceSchema,
} from "./billing.validation";

const router = Router();

router.get("/", billingController.get);
router.get(
    "/invoices/:id",
    validateRequest(invoiceIdParamSchema),
    billingController.getInvoice,
);
router.get(
    "/contracts/:id.pdf",
    validateRequest(contractIdParamSchema),
    billingController.getContractPdf,
);
router.get(
    "/invoices/:id.pdf",
    validateRequest(invoiceIdParamSchema),
    billingController.getInvoicePdf,
);
router.post(
    "/invoices/:id/pay",
    validateRequest(payInvoiceSchema),
    billingController.payInvoice,
);

export const billingRouter = router;