import type { TwoFactorMethod } from "../../../prisma/generated/prisma/enums";

/**
 * Methods the client can pick from when consuming a 2FA challenge. Kept in
 * sync with the Prisma `TwoFactorMethod` enum.
 */
export type WireTwoFactorMethod =
    | "totp"
    | "email-otp"
    | "recovery-code";

export const toDbTwoFactorMethod = (wire: WireTwoFactorMethod): TwoFactorMethod => {
    switch (wire) {
        case "totp":
            return "TOTP";
        case "email-otp":
            return "EMAIL_OTP";
        case "recovery-code":
            return "RECOVERY_CODE";
    }
};

export const fromDbTwoFactorMethod = (db: TwoFactorMethod): WireTwoFactorMethod => {
    switch (db) {
        case "TOTP":
            return "totp";
        case "EMAIL_OTP":
            return "email-otp";
        case "RECOVERY_CODE":
            return "recovery-code";
    }
};

/** Returned by POST /auth/2fa/verify on success. */
export interface ITwoFactorVerifyResult {
    /** ISO 8601 — when the issued access token expires. */
    expiresAt: string;
    /** True if this device was promoted to "trusted" by the caller. */
    trustedDevice: boolean;
}

export interface ITwoFactorChallengeInfo {
    /** Opaque token the client echoes back to /auth/2fa/verify. */
    challengeToken: string;
    /** Method the user should use to unlock this challenge. */
    method: WireTwoFactorMethod;
    /** Seconds until the challenge expires (RFC-style TTL). */
    expiresInSeconds: number;
}