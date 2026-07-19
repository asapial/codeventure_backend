/** Mirrors the frontend `SessionUser` type. */
export interface ISessionUser {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "owner" | "admin" | "editor" | "viewer";
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
