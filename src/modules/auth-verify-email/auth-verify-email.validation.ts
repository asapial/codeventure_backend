import { z } from "zod";

/**
 * Verification for `POST /auth/verify-email`.
 *
 * Accepts either a one-time 6-digit OTP *or* a token from the magic-link
 * email. The frontend `/verify-email` page supports both paths via a
 * tab switcher.
 */
export const verifyEmailSchema = z
    .object({
        body: z
            .object({
                email: z.string().trim().toLowerCase().email("Enter a valid email."),
                code: z
                    .string()
                    .trim()
                    .regex(/^\d{6}$/u, "Code must be 6 digits.")
                    .optional(),
                token: z.string().trim().min(20, "Token is missing or malformed.").max(256).optional(),
            })
            .refine(
                (b) => Boolean(b.code) !== Boolean(b.token),
                { message: "Provide either a 6-digit code OR a magic-link token.", path: ["code"] },
            ),
    })
    .strict();

/**
 * Verification for `POST /auth/verify-email/resend`. Always returns success
 * (does not leak whether the email exists); the body just collects the
 * email to send a fresh code to.
 */
export const resendVerificationSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email("Enter a valid email."),
    }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>["body"];
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>["body"];