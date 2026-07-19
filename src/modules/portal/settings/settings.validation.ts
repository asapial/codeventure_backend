import { z } from "zod";

const roleEnum = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

export const patchProfileSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1).max(120).optional(),
        jobTitle: z.string().trim().max(120).nullable().optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        timezone: z.string().trim().min(1).max(60).optional(),
        locale: z
            .string()
            .trim()
            .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
            .optional(),
        avatarUrl: z.string().url().nullable().optional(),
    }),
});

export const patchOrganizationSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1).max(120).optional(),
        website: z.string().url().nullable().optional(),
        industry: z.string().trim().max(80).nullable().optional(),
        addressLines: z
            .array(z.string().trim().min(1).max(200))
            .max(8)
            .optional(),
        timezone: z.string().trim().min(1).max(60).optional(),
        logoUrl: z.string().url().nullable().optional(),
    }),
});

export const inviteTeamSchema = z.object({
    body: z.object({
        email: z.string().email().toLowerCase(),
        role: roleEnum,
        jobTitle: z.string().trim().max(120).optional(),
    }),
});

export const updateMemberSchema = z.object({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
        role: roleEnum.optional(),
        jobTitle: z.string().trim().max(120).nullable().optional(),
        status: z.enum(["active", "suspended"]).optional(),
    }),
});

export const memberIdParamSchema = z.object({
    params: z.object({ id: z.string().min(1) }),
});

export const sessionIdParamSchema = z.object({
    params: z.object({ id: z.string().min(1) }),
});

export const exportRequestSchema = z.object({
    body: z.object({
        sections: z
            .array(
                z.enum([
                    "profile",
                    "organization",
                    "projects",
                    "invoices",
                    "tickets",
                    "maintenance",
                    "files",
                ]),
            )
            .min(1)
            .max(7),
        delivery: z.enum(["download", "email"]).optional().default("download"),
    }),
});

export type PatchProfileBody = z.infer<typeof patchProfileSchema>["body"];
export type PatchOrganizationBody = z.infer<typeof patchOrganizationSchema>["body"];
export type InviteTeamBody = z.infer<typeof inviteTeamSchema>["body"];
export type UpdateMemberBody = z.infer<typeof updateMemberSchema>["body"];
export type ExportRequestBody = z.infer<typeof exportRequestSchema>["body"];