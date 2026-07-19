import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";
import status from "http-status";
import AppError from "../errorHelpers/AppError";
import { handleZodError } from "../errorHelpers/handleZodError";

/**
 * Zod request validation middleware.
 *
 * Wrap your Zod schema and use it on a route. The schema may include
 * `body`, `params`, and/or `query` keys; each is validated against the
 * matching Express request field. On success the parsed (typed) value is
 * assigned back to `req.<field>` so handlers see coerced defaults.
 *
 * Throws an AppError(400, ...) via globalErrorHandler on failure — the
 * handler converts Zod issues into a `fieldErrors` map keyed by dotted
 * path so the frontend RHF `zodResolver` can highlight individual fields.
 */
export const validateRequest =
    (schema: ZodSchema) =>
    (req: Request, _res: Response, next: NextFunction) => {
        try {
            const parsed = schema.parse({
                body: req.body ?? {},
                params: req.params ?? {},
                query: req.query ?? {},
            });

            if (parsed.body !== undefined) req.body = parsed.body;
            if (parsed.params !== undefined) {
                req.params = parsed.params as Record<string, string>;
            }
            if (parsed.query !== undefined) {
                // Express 5 makes req.query a getter — assign via Object.assign
                // to avoid the "Cannot set property query" error.
                Object.assign(req.query, parsed.query);
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const { statusCode, code, message, fieldErrors } =
                    handleZodError(error);
                return next(
                    new AppError(statusCode, message, { code, fieldErrors }),
                );
            }
            next(
                new AppError(
                    status.BAD_REQUEST,
                    "Request validation failed.",
                    { code: "VALIDATION_ERROR" },
                ),
            );
        }
    };
