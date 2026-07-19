import status from "http-status";
import { randomBytes, createHash } from "node:crypto";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { tokenUtils } from "../../utils/token";
import { cookieUtils } from "../../utils/cookie";
import { envVars } from "../../config/env";
import type {
    SignInInput,
    SignUpInput,
    ForgotPasswordInput,
    ResetPasswordInput,
} from "./auth.validation";
import type { IAuthSessionResult, ISessionUser } from "./auth.type";

/** Convert a DB User row into the wire-format SessionUser. */
const toSessionUser = (user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    jobTitle: string | null;
    accountRole: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}): ISessionUser => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.image,
    role: user.accountRole.toLowerCase() as ISessionUser["role"],
});

/** Build the JWT payload minted for the access token cookie. */
const buildTokenPayload = (user: {
    id: string;
    email: string;
    accountRole: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}) => ({
    userId: user.id,
    email: user.email,
    role: user.accountRole,
});

/** Set both the canonical `accessToken` cookie AND the `cv_session` alias. */
const setSessionCookies = (res: Parameters<typeof tokenUtils.setAccessTokenCookie>[0], token: string) => {
    tokenUtils.setAccessTokenCookie(res, token);
    tokenUtils.setCvSessionCookie(res, token);
};

const clearSessionCookies = (res: Parameters<typeof tokenUtils.clearCvSessionCookie>[0]) => {
    tokenUtils.clearCvSessionCookie(res);
    // Mirror-clear the accessToken cookie with the same options used at set.
    cookieUtils.clearCookie(res, "accessToken", {
        httpOnly: true,
        secure: envVars.NODE_ENV === "production",
        sameSite: envVars.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    });
};

const signIn = async (
    res: Parameters<typeof setSessionCookies>[0],
    input: SignInInput,
): Promise<IAuthSessionResult> => {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            accountRole: true,
            password: true,
            isActive: true,
            isDeleted: true,
        },
    });

    if (!user || !user.password) {
        throw new AppError(status.UNAUTHORIZED, "Invalid email or password.");
    }

    const ok = await verifyPassword(input.password, user.password);
    if (!ok) {
        throw new AppError(status.UNAUTHORIZED, "Invalid email or password.");
    }

    if (user.isDeleted) {
        throw new AppError(status.FORBIDDEN, "This account has been deleted.");
    }
    if (!user.isActive) {
        throw new AppError(status.FORBIDDEN, "This account has been deactivated.");
    }

    const token = tokenUtils.createAccessToken(buildTokenPayload(user));
    setSessionCookies(res, token);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return { user: toSessionUser(user), expiresAt };
};

const signUp = async (
    res: Parameters<typeof setSessionCookies>[0],
    input: SignUpInput,
): Promise<IAuthSessionResult> => {
    const existing = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
    });
    if (existing) {
        throw new AppError(
            status.CONFLICT,
            "An account with this email already exists.",
            { code: "EMAIL_TAKEN", fieldErrors: { email: ["Email is already in use."] } },
        );
    }

    const hashed = await hashPassword(input.password);

    // This application authenticates with its own scrypt hash and JWT
    // cookies. Creating the user through the same path keeps registration
    // and login on one consistent credential system.
    const user = await prisma.user.create({
        data: {
            id: randomBytes(16).toString("hex"),
            email: input.email,
            name: input.name,
            password: hashed,
        },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            accountRole: true,
        },
    });

    const token = tokenUtils.createAccessToken(buildTokenPayload(user));
    setSessionCookies(res, token);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return { user: toSessionUser(user), expiresAt };
};

const signOut = async (res: Parameters<typeof clearSessionCookies>[0]): Promise<null> => {
    clearSessionCookies(res);
    return null;
};

const getSession = async (
    req: { cookies: Record<string, string | undefined> },
): Promise<IAuthSessionResult | null> => {
    const accessToken = cookieUtils.getCookie(
        req as Parameters<typeof cookieUtils.getCookie>[0],
        "accessToken",
    );
    if (!accessToken) return null;

    // Lazy import to avoid a circular dep at module load.
    const { jwtUtils } = await import("../../utils/jwt");
    const verified = jwtUtils.vefifyToken(accessToken, envVars.ACCESS_TOKEN_SECRET);
    if (!verified.success || !verified.data) return null;

    const { userId } = verified.data as { userId: string };
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            accountRole: true,
            isActive: true,
            isDeleted: true,
        },
    });
    if (!user || user.isDeleted || !user.isActive) return null;

    // expiresAt = JWT exp if available, otherwise +24h.
    let expiresAt: string;
    if (typeof verified.data === "object" && "exp" in verified.data && typeof verified.data.exp === "number") {
        expiresAt = new Date(verified.data.exp * 1000).toISOString();
    } else {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    return { user: toSessionUser(user), expiresAt };
};

// Maximum number of reset requests a user can make in FORGOT_WINDOW_MS.
// Anything beyond this rate-limit creates a SecurityAlert but still returns
// `{ ok: true }` to the caller so we never leak whether the email exists.
const FORGOT_PASSWORD_MAX_PER_HOUR = 5;
const FORGOT_WINDOW_MS = 60 * 60 * 1000;

const forgotPassword = async (input: ForgotPasswordInput): Promise<{ ok: true }> => {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, isDeleted: true, isActive: true },
    });

    // Always return ok — never leak whether the email exists.
    if (!user || user.isDeleted || !user.isActive) {
        return { ok: true };
    }

    const since = new Date(Date.now() - FORGOT_WINDOW_MS);
    const recentCount = await prisma.passwordResetToken.count({
        where: { userId: user.id, createdAt: { gte: since } },
    });

    if (recentCount >= FORGOT_PASSWORD_MAX_PER_HOUR) {
        // Record the abuse signal but still return ok — never reveal the lockout
        // to a stranger probing email addresses.
        await prisma.securityAlert.create({
            data: {
                userId: user.id,
                kind: "OTP_LOCKED",
                message: `Too many password reset requests. Try again in about ${Math.ceil(
                    FORGOT_WINDOW_MS / 60_000,
                )} minutes.`,
                metadata: { source: "forgot_password", count: recentCount },
            },
        });
        return { ok: true };
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
    });

    // In a real deployment, hand off to an email service here.
    // For now we log the link so the developer can copy/paste it.
    const link = `${envVars.FRONTEND_URL ?? "http://localhost:3000"}/reset-password?token=${rawToken}`;
    // eslint-disable-next-line no-console
    console.info(`[auth] Password reset link for ${input.email}: ${link}`);

    return { ok: true };
};

const resetPassword = async (input: ResetPasswordInput): Promise<{ ok: true }> => {
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        throw new AppError(
            status.BAD_REQUEST,
            "This reset link is invalid or has expired.",
            { code: "RESET_TOKEN_INVALID" },
        );
    }

    const hashed = await hashPassword(input.password);

    await prisma.$transaction([
        prisma.user.update({
            where: { id: record.userId },
            data: { password: hashed },
        }),
        prisma.passwordResetToken.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
        }),
        // Revoke all BetterAuth sessions for this user — they need to sign in
        // again with the new password. JWTs issued from those sessions become
        // unusable because the user row no longer matches any future check.
        prisma.session.deleteMany({ where: { userId: record.userId } }),
        // Audit log + in-app security alert so the user sees this in their
        // account security centre.
        prisma.securityAlert.create({
            data: {
                userId: record.userId,
                kind: "PASSWORD_CHANGED",
                message: "Your password was changed. All other sessions were signed out.",
            },
        }),
        prisma.activityEvent.create({
            data: {
                projectId: null, // system-wide event — not tied to a project
                actorId: record.userId,
                type: "AUTH_PASSWORD_RESET",
                title: "Password reset",
                description: "All sessions were revoked after a successful password reset.",
            },
        }),
    ]);

    return { ok: true };
};

export const authService = {
    signIn,
    signUp,
    signOut,
    getSession,
    forgotPassword,
    resetPassword,
};
