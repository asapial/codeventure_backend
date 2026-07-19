import { z } from "zod";

export const slugParamSchema = z.object({
    params: z.object({
        slug: z.string().min(1).max(120),
    }),
});

const approvalKind = z.enum([
    "design",
    "copy",
    "scope-change",
    "launch",
    "general",
]);

const approvalStatus = z.enum([
    "pending",
    "approved",
    "changes-requested",
    "rejected",
]);

const visibility = z.enum(["all", "customer", "internal"]);

export const approvalRespondSchema = z.object({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
        decision: approvalStatus.refine((v) => v !== "pending", {
            message: "Decision must be a terminal state.",
        }),
        note: z.string().trim().max(2000).optional(),
    }),
});

export const changeRequestSchema = z.object({
    body: z.object({
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(10).max(4000),
        impact: z.enum(["low", "medium", "high"]).optional().default("medium"),
    }),
});

export const commentSchema = z.object({
    body: z.object({
        body: z.string().trim().min(1).max(4000),
        visibility: visibility.optional().default("customer"),
        parentId: z.string().optional(),
    }),
});

export const fileUploadSchema = z.object({
    body: z.object({
        fileId: z.string().min(1),
        name: z.string().min(1).max(240),
        mimeType: z.string().max(120).optional(),
        size: z.number().int().nonnegative().optional(),
        url: z.string().url(),
    }),
});

export const activityQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
});

export type ApprovalRespondBody = z.infer<typeof approvalRespondSchema>["body"];
export type ChangeRequestBody = z.infer<typeof changeRequestSchema>["body"];
export type CommentBody = z.infer<typeof commentSchema>["body"];
export type FileUploadBody = z.infer<typeof fileUploadSchema>["body"];
export type ActivityQuery = z.infer<typeof activityQuerySchema>["query"];

void approvalKind; // forward reference for potential use elsewhere