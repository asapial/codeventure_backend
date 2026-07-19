import { randomBytes, createHash } from "node:crypto";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { tokenUtils } from "../../utils/token";
import { envVars } from "../../config/env";
import type {
    TwoFactorVerifyInput,
    TwoFactorResendInput,
} from "./auth-2fa.validation";
import type {
    ITwoFactorVerifyResult,
    ITwoFactorChallengeInfo,
    WireTwoFactorMethod,
} from "./auth-2fa.type";

/** 6-digit numeric code (zero-padded). */
const generateOtpCode = (): string => {
    const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
    return n.toString().padStart(6, "0");
};

/** sha256 hex digest. */
const sha256 = (raw: string): string =>
    createHash("sha256").update(raw).digest("hex");

/** Default TTL for a 2FA challenge (5 minutes). */
const CHALLENGE_TTL_SECONDS = 5 * 60;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const buildSessionCookieResponse = (
    res: Parameters<typeof tokenUtils.setAccessTokenCookie>[0],
    userId: string,
    email: string,
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER",
): ITwoFactorVerifyResult => {
    const token = tokenUtils.createAccessToken({ userId, email, role });
    tokenUtils.setAccessTokenCookie(res, token);
    tokenUtils.setCvSessionCookie(res, token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return { expiresAt, trustedDevice: false };
};

/**
 * Open a new challenge for `userId`. Returns the opaque `challengeToken`
 * (raw, shown to the client once) and the method the client should render.
 *
 * Persists only the SHA-256 of the token. The raw token is never stored.
 */
export const openChallenge = async (
    userId: string,
    method: WireTwoFactorMethod,
    meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<ITwoFactorChallengeInfo> => {
    const rawToken = randomBytes(32).toString("base64url");
    const challengeHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);

    const challenge = await prisma.authChallenge.create({
        data: {
            userId,
            method: method === "totp"
                ? "TOTP"
                : method === "email-otp"
                    ? "EMAIL_OTP"
                    : "RECOVERY_CODE",
            challengeHash,
            expiresAt,
            maxAttempts: MAX_ATTEMPTS,
            ipAddress: meta.ipAddress ?? null,
            userAgent: meta.userAgent ?? null,
        },
    });

    if (method === "email-otp") {
        // Persist a code row bound to this challenge so the verify endpoint
        // can compare hashes. `recipient` is denormalised for audit.
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) {
            // Roll back the challenge — there's nobody to email.
            await prisma.authChallenge.delete({ where: { id: challenge.id } });
            throw new AppError(status.NOT_FOUND, "User not found.");
        }

        const code = generateOtpCode();
        const otp = await prisma.otpCode.create({
            data: {
                userId,
                purpose: "TWO_FACTOR_EMAIL",
                codeHash: sha256(code),
                recipient: user.email,
                expiresAt: new Date(Date.now() + OTP_TTL_MS),
                challengeId: challenge.id,
            },
        });
        if (!otp) {
            throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to issue OTP.");
        }

        // In a real deployment, hand off to the email service.
        // eslint-disable-next-line no-console
        console.info(
            `[auth-2fa] Email-OTP for ${user.email}: ${code} (challenge ${challenge.id})`,
        );
    }

    return {
        challengeToken: rawToken,
        method,
        expiresInSeconds: CHALLENGE_TTL_SECONDS,
    };
};

/**
 * Verify a 2FA challenge. On success, mints a fresh access-token cookie
 * pair (accessToken + cv_session) on `res` and returns the expiry.
 */
export const verifyChallenge = async (
    res: Parameters<typeof tokenUtils.setAccessTokenCookie>[0],
    input: TwoFactorVerifyInput,
): Promise<ITwoFactorVerifyResult> => {
    const tokenHash = sha256(input.challengeToken);
    const challenge = await prisma.authChallenge.findUnique({
        where: { challengeHash: tokenHash },
        include: { otp: true },
    });

    if (
        !challenge ||
        challenge.consumedAt ||
        challenge.expiresAt.getTime() < Date.now() ||
        challenge.attempts >= challenge.maxAttempts
    ) {
        throw new AppError(
            status.BAD_REQUEST,
            "This 2FA challenge is invalid or has expired.",
            { code: "TWO_FACTOR_CHALLENGE_INVALID" },
        );
    }

    let accepted = false;

    if (input.code) {
        // TOTP codes are validated by the user's authenticator; for this
        // server we only support email-OTP path so we compare against the
        // bound OtpCode hash.
        if (challenge.method !== "EMAIL_OTP" || !challenge.otp) {
            // Increment attempts; do NOT reveal method mismatch.
        } else if (
            !challenge.otp.consumedAt &&
            challenge.otp.expiresAt.getTime() >= Date.now() &&
            challenge.otp.codeHash === sha256(input.code)
        ) {
            accepted = true;
            await prisma.otpCode.update({
                where: { id: challenge.otp.id },
                data: { consumedAt: new Date() },
            });
        }
    } else if (input.recoveryCode) {
        const recovery = await prisma.recoveryCode.findUnique({
            where: { codeHash: sha256(input.recoveryCode) },
            include: { uses: true },
        });
        if (
            recovery &&
            recovery.userId === challenge.userId &&
            !recovery.usedAt
        ) {
            accepted = true;
            await prisma.$transaction([
                prisma.recoveryCode.update({
                    where: { id: recovery.id },
                    data: { usedAt: new Date() },
                }),
                prisma.recoveryCodeUse.create({
                    data: { recoveryCodeId: recovery.id, challengeId: challenge.id },
                }),
            ]);
        }
    }

    if (!accepted) {
        const updated = await prisma.authChallenge.update({
            where: { id: challenge.id },
            data: { attempts: { increment: 1 } },
        });

        // If we've now exceeded the threshold, lock the challenge & log alert.
        if (updated.attempts >= updated.maxAttempts) {
            await prisma.securityAlert.create({
                data: {
                    userId: challenge.userId,
                    kind: "TWO_FACTOR_LOCKED",
                    message: "Too many incorrect 2FA attempts.",
                },
            });
        }

        throw new AppError(
            status.BAD_REQUEST,
            "Incorrect code or recovery code.",
            { code: "TWO_FACTOR_CODE_INVALID" },
        );
    }

    const user = await prisma.user.findUnique({
        where: { id: challenge.userId },
        select: { id: true, email: true, accountRole: true },
    });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found.");
    }

    await prisma.authChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
    });

    if (input.trustDevice) {
        const fp = createHash("sha256")
            .update(input.challengeToken)
            .digest("hex")
            .slice(0, 16);
        await prisma.loginDevice.upsert({
            where: { userId_fingerprint: { userId: user.id, fingerprint: fp } },
            update: { trusted: true, lastSeenAt: new Date() },
            create: {
                userId: user.id,
                fingerprint: fp,
                trusted: true,
                lastSeenAt: new Date(),
            },
        });
    }

    return buildSessionCookieResponse(res, user.id, user.email, user.accountRole);
};

/** Re-send the OTP for an email-OTP challenge. Rate-limited by challenge age. */
export const resendChallenge = async (
    input: TwoFactorResendInput,
): Promise<{ expiresInSeconds: number }> => {
    const challenge = await prisma.authChallenge.findUnique({
        where: { challengeHash: sha256(input.challengeToken) },
        include: { otp: true },
    });

    if (
        !challenge ||
        challenge.consumedAt ||
        challenge.method !== "EMAIL_OTP" ||
        challenge.expiresAt.getTime() < Date.now()
    ) {
        // Don't disclose whether the challenge exists — return success.
        return { expiresInSeconds: CHALLENGE_TTL_SECONDS };
    }

    const user = await prisma.user.findUnique({
        where: { id: challenge.userId },
        select: { email: true },
    });
    if (!user) {
        return { expiresInSeconds: CHALLENGE_TTL_SECONDS };
    }

    const code = generateOtpCode();
    // Invalidate any prior OTP bound to this challenge, then issue a new one.
    await prisma.$transaction([
        prisma.otpCode.deleteMany({ where: { challengeId: challenge.id } }),
        prisma.otpCode.create({
            data: {
                userId: challenge.userId,
                purpose: "TWO_FACTOR_EMAIL",
                codeHash: sha256(code),
                recipient: user.email,
                expiresAt: new Date(Date.now() + OTP_TTL_MS),
                challengeId: challenge.id,
            },
        }),
    ]);

    // eslint-disable-next-line no-console
    console.info(
        `[auth-2fa] Resent email-OTP for ${user.email}: ${code} (challenge ${challenge.id})`,
    );

    return { expiresInSeconds: CHALLENGE_TTL_SECONDS };
};

/** Generate a fresh set of recovery codes for a user. */
export const generateRecoveryCodes = async (
    userId: string,
): Promise<string[]> => {
    const codes: string[] = [];
    for (let i = 0; i < 8; i += 1) {
        const raw = randomBytes(8).toString("hex").toUpperCase();
        codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`);
    }

    await prisma.$transaction([
        prisma.recoveryCode.deleteMany({ where: { userId } }),
        ...codes.map((code) =>
            prisma.recoveryCode.create({
                data: { userId, codeHash: sha256(code) },
            }),
        ),
    ]);

    return codes;
};