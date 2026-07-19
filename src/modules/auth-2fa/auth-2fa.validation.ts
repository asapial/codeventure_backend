import { z } from "zod";

/**
 * Validation for `POST /auth/2fa/verify`.
 *
 * Accepts exactly one of `code` (TOTP / email-OTP) or `recoveryCode`
 * (one-shot recovery code). The challenge token is always required.
 */
export const twoFactorVerifySchema = z
    .object({
        body: z
            .object({
                challengeToken: z
                    .string()
                    .trim()
                    .min(20, "Challenge token is missing or malformed.")
                    .max(256, "Challenge token is too long."),
                code: z
                    .string()
                    .trim()
                    .regex(/^\d{6}$/u, "Code must be 6 digits.")
                    .optional(),
                recoveryCode: z
                    .string()
                    .trim()
                    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/u, "Recovery code must look like XXXX-XXXX-XXXX-XXXX.")
                    .optional(),
                trustDevice: z.boolean().optional().default(false),
            })
            .refine(
                (b) => Boolean(b.code) !== Boolean(b.recoveryCode),
                { message: "Provide either a 6-digit code OR a recovery code, not both.", path: ["code"] },
            ),
    })
    .strict();

/**
 * Validation for `POST /auth/2fa/resend`. Only challenge tokens issued for
 * the email-OTP method can be re-sent; TOTP has no "resend" concept.
 */
export const twoFactorResendSchema = z.object({
    body: z.object({
        challengeToken: z
            .string()
            .trim()
            .min(20, "Challenge token is missing or malformed.")
            .max(256, "Challenge token is too long."),
    }),
});

export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>["body"];
export type TwoFactorResendInput = z.infer<typeof twoFactorResendSchema>["body"];