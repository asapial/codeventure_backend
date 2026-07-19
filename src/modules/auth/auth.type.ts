import type { AccountRole } from "../../../prisma/generated/prisma/enums";

/** Mirrors the frontend `SessionUser` type. */
export interface ISessionUser {
    id: string;
    name: string;
    email: string;
    image: string | null;
    jobTitle: string | null;
    accountRole: AccountRole;
}

/** Mirrors the frontend `Session` type. */
export interface ISession {
    user: ISessionUser;
    expiresAt: string; // ISO 8601
}

/** Body shape returned by /auth/sign-in, /auth/sign-up, /auth/session. */
export interface IAuthSessionResult {
    user: ISessionUser;
    expiresAt: string;
}
