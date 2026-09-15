export const ERROR_CODES = [
  // 400
  "VALIDATION_FAILED",
  "BAD_REQUEST",
  // 401
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
  // 403
  "FORBIDDEN",
  // 404
  "NOT_FOUND",
  // 409
  "DUPLICATE",
  "CONFLICT",
  // 413 / 415 / 429
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  // 500 / 503
  "INTERNAL",
  "DEPENDENCY_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  /** true = an expected failure we chose to raise; false = a bug */
  readonly isOperational = true;
  /** extra context for the client, e.g. which fields failed validation */
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // without this, the stack starts inside this constructor rather than at the throw site
    Error.captureStackTrace(this, this.constructor);
  }

  // ---- the cases we actually raise ----

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "BAD_REQUEST", message, details);
  }

  static validation(message: string, details?: unknown) {
    return new AppError(400, "VALIDATION_FAILED", message, details);
  }

  /** deliberately vague: never say whether the email exists */
  static unauthenticated(message = "Authentication required") {
    return new AppError(401, "UNAUTHENTICATED", message);
  }

  static tokenExpired() {
    return new AppError(401, "TOKEN_EXPIRED", "Access token has expired");
  }

  static tokenInvalid() {
    return new AppError(401, "TOKEN_INVALID", "Access token is invalid");
  }

  static forbidden(message = "You do not have permission to do that") {
    return new AppError(403, "FORBIDDEN", message);
  }

  /** names the resource type only — never the id, which would confirm it exists */
  static notFound(resource: string) {
    return new AppError(404, "NOT_FOUND", `${resource} not found`);
  }

  static duplicate(message: string, details?: unknown) {
    return new AppError(409, "DUPLICATE", message, details);
  }

  static conflict(message: string) {
    return new AppError(409, "CONFLICT", message);
  }

  static payloadTooLarge(message: string) {
    return new AppError(413, "PAYLOAD_TOO_LARGE", message);
  }

  static unsupportedMediaType(message: string) {
    return new AppError(415, "UNSUPPORTED_MEDIA_TYPE", message);
  }

  static dependencyUnavailable(service: string) {
    return new AppError(503, "DEPENDENCY_UNAVAILABLE", `${service} is unavailable`);
  }
}

/** Distinguishes our deliberate failures from genuine bugs. */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
