/**
 * Domain error type thrown inside controllers / services.
 *
 * The shape mirrors the frontend's `ApiErrorBody`:
 *   { error: { code, message, fieldErrors?, requestId? } }
 *
 * `code` is a stable, machine-readable identifier (e.g. `INVALID_CREDENTIALS`,
 * `EMAIL_TAKEN`) that the client can branch on. Optional `fieldErrors` carries
 * per-field validation messages keyed by input name.
 */
class AppError extends Error {
  public statusCode: number;
  public code: string;
  public fieldErrors?: Record<string, string[]>;

  constructor(
    statusCode: number,
    message: string,
    options: { code?: string; fieldErrors?: Record<string, string[]> } = {},
    stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options.code ?? defaultCodeForStatus(statusCode);
    if (options.fieldErrors) this.fieldErrors = options.fieldErrors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Stable string identifiers we send over the wire. Default codes are
 * derived from the HTTP status; controllers can override for nuance
 * (e.g. 400 → `VALIDATION_ERROR` vs `INVALID_CREDENTIALS`).
 */
function defaultCodeForStatus(statusCode: number): string {
  if (statusCode >= 500) return "SERVER_ERROR";
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    default:
      return "REQUEST_FAILED";
  }
}

export default AppError;