import { z } from "zod";

export const invoiceIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
});

export const contractIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
});

export const payInvoiceSchema = z.object({
    params: z.object({
        id: z.string().min(1),
    }),
    body: z.object({
        paymentMethodId: z.string().min(1),
        idempotencyKey: z
            .string()
            .min(8)
            .max(120)
            .optional(),
    }),
});

export type PayInvoiceBody = z.infer<typeof payInvoiceSchema>["body"];