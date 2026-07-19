import type { ReferralSourceType, AccountRole } from "../../../prisma/generated/prisma/enums";

export const fromWireSignupSource = (wire: string): ReferralSourceType => {
    switch (wire) {
        case "direct":
            return "DIRECT";
        case "organic-search":
            return "ORGANIC_SEARCH";
        case "paid-ad":
            return "PAID_AD";
        case "social":
            return "SOCIAL";
        case "referral":
            return "REFERRAL";
        case "email-campaign":
            return "EMAIL_CAMPAIGN";
        default:
            return "OTHER";
    }
};

export const fromWireAccountRole = (wire: string): AccountRole => {
    switch (wire) {
        case "owner":
            return "OWNER";
        case "admin":
            return "ADMIN";
        case "editor":
            return "EDITOR";
        default:
            return "VIEWER";
    }
};

/** Response from POST /auth/register. */
export interface IRegisterResult {
    userId: string;
    email: string;
    requiresEmailVerification: boolean;
}