import { JwtPayload, SignOptions } from "jsonwebtoken";
import { jwtUtils } from "./jwt";
import { envVars } from "../config/env";
import { cookieUtils } from "./cookie";
import { Response } from "express";

const isProd = envVars.NODE_ENV === "production";

const createAccessToken = (payload: JwtPayload) => {
    const accessToken = jwtUtils.createToken(
        payload,
        envVars.ACCESS_TOKEN_SECRET,
        {
            expiresIn: envVars.ACCESS_TOKEN_EXPIRES_IN
        } as SignOptions
    );
    return accessToken;
};

const createRefreshToken = (payload: JwtPayload) => {
    const refreshToken = jwtUtils.createToken(
        payload,
        envVars.REFRESH_TOKEN_SECRET,
        {
            expiresIn: envVars.REFRESH_TOKEN_EXPIRES_IN
        } as SignOptions
    );
    return refreshToken;
};

/**
 * Standard access-token cookie (httponly, secure in prod).
 * This is the canonical credential cookie for the backend.
 */
const setAccessTokenCookie = (res: Response, token: string) => {
    cookieUtils.setCookie(res, "accessToken", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 1000, // 1 day
    });
};

/**
 * Mirror cookie with the same value as `accessToken` so the frontend's
 * `lib/auth/session.ts` (which reads `cv_session`) sees an authenticated
 * session during RSC render without an extra round-trip.
 *
 * NOT httponly — the frontend reads it via `next/headers` cookies().
 */
const setCvSessionCookie = (res: Response, token: string) => {
    cookieUtils.setCookie(res, "cv_session", token, {
        httpOnly: false,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 1000, // 1 day
    });
};

const clearCvSessionCookie = (res: Response) => {
    cookieUtils.clearCookie(res, "cv_session", {
        httpOnly: false,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
    });
};

const setRefreshTokenCookie = (res: Response, token: string) => {
    cookieUtils.setCookie(res, "refreshToken", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
    });
};

const setBetterAuthSessionCookie = (res: Response, token: string) => {
    cookieUtils.setCookie(res, cookieUtils.betterAuthSessionCookieName, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 1000, // 1 day
    });
};

export const tokenUtils = {
    createAccessToken,
    createRefreshToken,
    setAccessTokenCookie,
    setCvSessionCookie,
    clearCvSessionCookie,
    setRefreshTokenCookie,
    setBetterAuthSessionCookie,
};