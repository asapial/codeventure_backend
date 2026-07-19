/**
 * Wire-shape for an error response emitted by `globalErrorHandler`.
 * Matches the frontend's `ApiErrorBody`:
 *
 *   { error: { code, message, fieldErrors?, requestId? } }
 *
 * Extra fields (`stack`, `raw`) are only included when `NODE_ENV=development`.
 */
export interface FieldErrorMap {
  [path: string]: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: FieldErrorMap;
    requestId?: string;
  };
}

/**
 * Backwards-compat type for callers that still expect the old envelope.
 * New code should prefer `ApiErrorBody`.
 */
export interface TErrorSources {
  path: string;
  message: string;
}

export interface TErrorResponse {
  success?: false;
  message?: string;
  stack?: string;
  error?: unknown;
}
