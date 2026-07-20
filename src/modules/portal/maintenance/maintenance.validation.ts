import { z } from "zod";

/**
 * Maintenance request submission body (C5).
 *
 * Wire shape is {@link SubmitMaintenanceRequestBodyV2} (`requestType` +
 * `priority`). For one minor-version cycle we also accept the legacy
 * {@link SubmitMaintenanceRequestBodyV1} (`type` + `severity`) keys so
 * older clients keep working while the field names propagate.
 */
const requestTypeEnum = z.enum([
    "update",
    "bug",
    "content",
    "performance",
    "security",
    "backup",
    "consult",
]);

const priorityEnum = z.enum(["low", "normal", "high", "urgent"]);

/** V2 — preferred. */
const submitMaintenanceRequestSchemaV2 = z.object({
    body: z.object({
        requestType: requestTypeEnum,
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(10).max(4000),
        priority: priorityEnum.optional().default("normal"),
    }),
});

/** V1 — deprecated. Normalised to V2 in the service layer. */
const submitMaintenanceRequestSchemaV1 = z.object({
    body: z.object({
        type: requestTypeEnum,
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(10).max(4000),
        severity: z.enum(["low", "medium", "high", "urgent"]).optional()
            // legacy "medium" → new "normal"
            .transform((v) => (v === "medium" ? "normal" : v ?? "normal")),
    }),
});

export const submitMaintenanceRequestSchema = z.union([
    submitMaintenanceRequestSchemaV2,
    submitMaintenanceRequestSchemaV1,
]);

export type SubmitMaintenanceRequestBodyV2 = z.infer<
    typeof submitMaintenanceRequestSchemaV2
>["body"];

export type SubmitMaintenanceRequestBodyV1 = z.infer<
    typeof submitMaintenanceRequestSchemaV1
>["body"];

/** Service-layer input (normalised). */
export type SubmitMaintenanceRequestBody = SubmitMaintenanceRequestBodyV2;