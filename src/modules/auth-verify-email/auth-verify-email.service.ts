import { randomBytes, createHash } from "node:crypto";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { envVars } from "../../config/env";
import type {
    VerifyEmailInput,
    ResendVerificationInput,
} from "./auth-verify-email.validation";

const sha256 = (raw: string): string =>
    createHash("sha256").update(raw).digest("hex");

const generateOtpCode = (): string => {
    const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
    return n.toString().padStart(6, "0");
};

const OTP_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Verify an email address via 6-digit code OR magic-link token.
 *
 * On success the user's `emailVerified` flag is flipped to true and a
 * `Verification` row is recorded for audit. Idempotent — calling twice
 * with the same code just re-asserts the verified flag.
 */
export const verifyEmail = async (
    input: VerifyEmailInput,
): Promise<{ verified: true }> => {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, emailVerified: true, isDeleted: true },
    });
    if (!user || user.isDeleted) {
        // Never leak whether the email exists.
        throw new AppError(
            status.BAD_REQUEST,
            "We couldn't verify this email. The code may have expired.",
            { code: "EMAIL_VERIFY_INVALID" },
        );
    }

    if (user.emailVerified) {
        return { verified: true };
    }

    let accepted = false;

    if (input.code) {
        const candidate = await prisma.otpCode.findFirst({
            where: {
                userId: user.id,
                purpose: "EMAIL_VERIFY",
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        if (candidate && candidate.codeHash === sha256(input.code)) {
            accepted = true;
            await prisma.otpCode.update({
                where: { id: candidate.id },
                data: { consumedAt: new Date() },
            });
        }
    } else if (input.token) {
        const candidate = await prisma.otpCode.findFirst({
            where: {
                userId: user.id,
                purpose: "EMAIL_VERIFY",
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        // Tokens are longer-lived random secrets; we compare SHA-256 hashes.
        if (candidate && candidate.codeHash === sha256(input.token)) {
            accepted = true;
            await prisma.otpCode.update({
                where: { id: candidate.id },
                data: { consumedAt: new Date() },
            });
        }
    }

    if (!accepted) {
        throw new AppError(
            status.BAD_REQUEST,
            "We couldn't verify this email. The code may have expired.",
            { code: "EMAIL_VERIFY_INVALID" },
        );
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
    });

    await prisma.verification.create({
        data: {
            id: randomBytes(16).toString("hex"),
            identifier: user.id,
            value: "EMAIL_VERIFIED",
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
    });

    return { verified: true };
};

/**
 * Always returns ok: true. Internally we either generate + persist a new
 * 6-digit code for the user (and log it for the dev email sink) or no-op
 * if the user no longer exists / isn't eligible.
 */
export const resendVerificationCode = async (
    input: ResendVerificationInput,
): Promise<{ sent: true }> => {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, emailVerified: true, isDeleted: true, isActive: true },
    });

    if (!user || user.isDeleted || !user.isActive || user.emailVerified) {
        return { sent: true };
    }

    const code = generateOtpCode();
    await prisma.otpCode.create({
        data: {
            userId: user.id,
            purpose: "EMAIL_VERIFY",
            codeHash: sha256(code),
            recipient: input.email,
            expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
    });

    // eslint-disable-next-line no-console
    console.info(
        `[verify-email] OTP for ${input.email}: ${code}`,
    );
    // Magic-link path: also log a URL with a 32-byte token.
    const token = randomBytes(32).toString("base64url");
    await prisma.otpCode.create({
        data: {
            userId: user.id,
            purpose: "EMAIL_VERIFY",
            codeHash: sha256(token),
            recipient: input.email,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
    });
    const link = `${envVars.FRONTEND_URL ?? "http://localhost:3000"}/verify-email?token=${token}&email=${encodeURIComponent(input.email)}`;
    // eslint-disable-next-line no-console
    console.info(`[verify-email] Magic link for ${input.email}: ${link}`);

    return { sent: true };
};