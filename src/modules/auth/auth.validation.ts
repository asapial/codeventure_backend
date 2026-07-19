import { z } from "zod";

export const signInSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email("Enter a valid email."),
        password: z.string().min(8, "Password must be at least 8 characters."),
    }),
});

export const signUpSchema = z.object({
    body: z.object({
        name: z
            .string()
            .trim()
            .min(2, "Name must be at least 2 characters.")
            .max(80, "Name is too long."),
        email: z.string().trim().toLowerCase().email("Enter a valid email."),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters.")
            .max(128, "Password is too long."),
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email("Enter a valid email."),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(20, "Reset token is required."),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters.")
            .max(128, "Password is too long."),
    }),
});

export type SignInInput = z.infer<typeof signInSchema>["body"];
export type SignUpInput = z.infer<typeof signUpSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
