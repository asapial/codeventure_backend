import status from "http-status";
import { ZodError } from "zod";

/**
 * Convert a ZodError into the canonical wire envelope used by the rest of
 * the app. Field paths are flattened into a dotted path so the client can
 * light up specific form fields.
 */
export interface NormalisedError {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string[]>;
}

export const handleZodError = (err: ZodError): NormalisedError => {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of err.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
  }

  return {
    statusCode: status.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message: "One or more fields failed validation.",
    fieldErrors,
  };
};
