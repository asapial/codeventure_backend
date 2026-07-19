import { z } from "zod";

export const submitMaintenanceRequestSchema = z.object({
    body: z.object({
        type: z.enum(["bug", "change", "question", "incident"]),
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(10).max(4000),
        severity: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
    }),
});

export type SubmitMaintenanceRequestBody = z.infer<
    typeof submitMaintenanceRequestSchema
>["body"];