/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { ZodError } from "zod";

import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { handleZodError } from "../errorHelpers/handleZodError";
import type { ApiErrorBody } from "../interfaces/error.interface";

/**
 * Translates any thrown value into the canonical wire envelope the frontend
 * `apiFetch` parser expects:
 *
 *   { error: { code, message, fieldErrors?, requestId? } }
 *
 * `req.id` is populated by the `requestId` middleware (see app.ts).
 */
export const globalErrorHandler = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (envVars.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[globalErrorHandler]", err);
  }

  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let code = "SERVER_ERROR";
  let message = "Internal Server Error";
  let fieldErrors: Record<string, string[]> | undefined;
  let stack: string | undefined;

  if (err instanceof ZodError) {
    const simplified = handleZodError(err);
    statusCode = simplified.statusCode;
    code = simplified.code;
    message = simplified.message;
    fieldErrors = simplified.fieldErrors;
    stack = err.stack;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    fieldErrors = err.fieldErrors;
    stack = err.stack;
  } else if (err instanceof Error) {
    statusCode = status.INTERNAL_SERVER_ERROR;
    message = err.message || message;
    stack = err.stack;
  }

  const body: ApiErrorBody & { stack?: string; raw?: unknown } = {
    error: {
      code,
      message,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0
        ? { fieldErrors }
        : {}),
      ...(req.id ? { requestId: req.id } : {}),
    },
    ...(envVars.NODE_ENV === "development"
      ? { stack, raw: err instanceof Error ? undefined : err }
      : {}),
  };

  res.status(statusCode).json(body);
}
