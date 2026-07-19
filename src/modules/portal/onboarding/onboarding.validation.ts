import { z } from "zod";

const communicationSchema = z.enum(["email", "phone", "slack", "teams"]);

const billingAddressSchema = z
    .object({
        line1: z.string().trim().min(1).max(200),
        line2: z.string().trim().max(200).optional(),
        city: z.string().trim().min(1).max(120),
        region: z.string().trim().min(1).max(120),
        postalCode: z.string().trim().min(1).max(20),
        country: z.string().trim().regex(/^[A-Z]{2}$/, "Country must be ISO-3166 alpha-2."),
    })
    .strict();

const primaryContactSchema = z
    .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(160),
        phone: z.string().trim().max(40).optional(),
    })
    .strict();

const updateOnboardingSchema = z
    .object({
        companyName: z.string().trim().max(160).optional(),
        businessType: z.string().trim().max(80).optional(),
        websiteUrl: z.string().trim().url().max(500).optional(),
        billingAddress: billingAddressSchema.optional(),
        primaryContact: primaryContactSchema.optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
        locale: z.string().trim().min(2).max(20).optional(),
        communication: communicationSchema.optional(),
        complete: z.boolean().optional(),
    })
    .strict();

export const updateOnboardingBodySchema = z.object({
    body: updateOnboardingSchema,
});

const invitationSchema = z
    .object({
        email: z.string().trim().email().max(160),
        role: z.enum(["owner", "admin", "editor", "viewer"]),
    })
    .strict();

export const invitationBodySchema = z.object({
    body: invitationSchema,
});

export type UpdateOnboardingBody = z.infer<typeof updateOnboardingSchema>;
export type InvitationBody = z.infer<typeof invitationSchema>;
