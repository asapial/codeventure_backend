import { z } from "zod";

/**
 * Wire-format enums mirroring the Prisma enums.
 * Kept in one place so the Zod schema stays human-readable.
 */
export const signupSourceSchema = z.enum([
    "direct",
    "organic-search",
    "paid-ad",
    "social",
    "referral",
    "email-campaign",
    "other",
]);

export const accountRoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);

const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long.")
    .refine((p) => /[a-z]/u.test(p) && /[A-Z0-9]/u.test(p), {
        message: "Password must include a lowercase letter and either an uppercase letter or a digit.",
    });

const websiteHoneypot = z.string().max(0, "Bot detected.").optional();

/**
 * Validation for `POST /auth/register`.
 *
 * Distinct from `/auth/sign-up` (the lightweight studio-style signup):
 * this is the full *customer registration* flow which also captures
 * first/last name, signup source, terms acceptance, optional referral
 * code, and optional invitation token.
 */
export const registerSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email("Enter a valid email."),
        password: passwordSchema,
        firstName: z.string().trim().min(1, "First name is required.").max(60),
        lastName: z.string().trim().min(1, "Last name is required.").max(60),
        signupSource: signupSourceSchema.optional(),
        referralCode: z
            .string()
            .trim()
            .min(3)
            .max(40)
            .regex(/^[A-Z0-9_-]+$/u, "Referral code must be alphanumeric.")
            .optional(),
        inviteToken: z.string().trim().min(20).max(256).optional(),
        acceptTerms: z.literal(true, {
            error: "You must accept the terms to register.",
        }),
        acceptPrivacy: z.literal(true, {
            error: "You must accept the privacy policy to register.",
        }),
        marketingOptIn: z.boolean().optional().default(false),
        website: websiteHoneypot,
    }),
});

/**
 * Validation for `POST /auth/invitations/accept`.
 *
 * Used when a user clicks the invite link from their email. We resolve
 * the token to an Invitation row and create / update the User + their
 * Organization membership.
 */
export const acceptInvitationSchema = z.object({
    body: z.object({
        token: z.string().trim().min(20, "Invitation token is missing or malformed.").max(256),
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        password: passwordSchema,
        acceptTerms: z.literal(true, {
            error: "You must accept the terms to continue.",
        }),
        website: websiteHoneypot,
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>["body"];
