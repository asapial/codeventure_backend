import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}

/**
 * Assigns a stable request id to every incoming request.
 *
 * - Reuses `x-request-id` header if the upstream (proxy / Next.js) already
 *   set one — this lets us trace a single user action end-to-end across
 *   the edge tier and the API.
 * - Otherwise generates a UUIDv4.
 * - Echoes the id back as `x-request-id` so the client can quote it in
 *   support tickets.
 * - Reads via `req.id` inside controllers; included by globalErrorHandler
 *   in the error envelope under `error.requestId`.
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id");
    const id = incoming && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();

    req.id = id;
    res.setHeader("x-request-id", id);
    next();
};
