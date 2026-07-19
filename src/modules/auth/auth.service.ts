import status from "http-status";
import { randomBytes, createHash } from "node:crypto";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { tokenUtils } from "../../utils/token";
import { cookieUtils } from "../../utils/cookie";
import { auth as betterAuth } from "../../lib/auth";
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
    accountRole: ISessionUser["accountRole"];
}): ISessionUser => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    jobTitle: user.jobTitle,
    accountRole: user.accountRole,
});

/** Build the JWT payload minted for the access token cookie. */
const buildTokenPayload = (user: {
    id: string;
    email: string;
    role: ISessionUser["accountRole"];
}) => ({
    userId: user.id,
    email: user.email,
    role: user.role,
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

    // Use BetterAuth's signup path so the Session row is created with the
    // correct token format expected by `getBetterAuthSessionToken`. Then
    // attach our password hash + idempotent-id on the same User row.
    const result = await betterAuth.api.signUpEmail({
        body: {
            email: input.email,
            password: input.password, // BetterAuth hashes internally; we keep our hash too.
            name: input.name,
        },
        asResponse: false,
    });

    // Prefer the user BetterAuth just created; fall back to a fresh insert
    // if BetterAuth is misconfigured for email/password.
    let user = await prisma.user.findUnique({
        where: { email: input.email },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            accountRole: true,
        },
    });

    if (!user) {
        user = await prisma.user.create({
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
    } else if (!user.jobTitle) {
        // Update password if missing (BetterAuth signed up but our hash isn't there).
        user = await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                jobTitle: true,
                accountRole: true,
            },
        });
    }

    // Forward the BetterAuth session cookie if any was set on the response.
    const setCookie = (result as { headers?: Headers } | undefined)?.headers?.get?.("set-cookie");
    if (setCookie) {
        res.setHeader("Set-Cookie", setCookie);
    }

    const token = tokenUtils.createAccessToken(buildTokenPayload(user!));
    setSessionCookies(res, token);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return { user: toSessionUser(user!), expiresAt };
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

const forgotPassword = async (input: ForgotPasswordInput): Promise<{ ok: true }> => {
    const user = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, isDeleted: true, isActive: true },
    });

    // Always return ok — never leak whether the email exists.
    if (!user || user.isDeleted || !user.isActive) {
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
