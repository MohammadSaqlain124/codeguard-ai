import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import { Error as MongooseError } from "mongoose";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { AppError, isAppError, type ErrorCode } from "../utils/AppError.js";

/** Every error response has exactly this shape. */
interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

interface FieldIssue {
  field: string;
  message: string;
}

/** MongoDB duplicate-key errors are driver errors, not Mongoose errors. */
function isDuplicateKeyError(err: unknown): err is { keyPattern?: Record<string, unknown> } {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}

function fromZod(err: ZodError): { status: number; code: ErrorCode; message: string; details: FieldIssue[] } {
  // Zod 4 exposes .issues, not .errors — every Zod 3 tutorial has this wrong
  const details = err.issues.map((i) => ({
    field: i.path.join(".") || "(root)",
    message: i.message,
  }));
  return { status: 400, code: "VALIDATION_FAILED", message: "Request validation failed", details };
}

function fromMongooseValidation(err: MongooseError.ValidationError) {
  const details: FieldIssue[] = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return { status: 400, code: "VALIDATION_FAILED" as ErrorCode, message: "Request validation failed", details };
}

function fromDuplicateKey(err: { keyPattern?: Record<string, unknown> }) {
  const fields = Object.keys(err.keyPattern ?? {});
  // never echo the value — it came from the request and may be another user's data
  const message =
    fields.length > 0
      ? `A record with that ${fields.join(" and ")} already exists`
      : "A record with those values already exists";
  return { status: 409, code: "DUPLICATE" as ErrorCode, message, details: fields.map((f) => ({ field: f, message: "must be unique" })) };
}

/**
 * The single funnel for every error. Registered last in app.ts.
 * Express identifies this as error middleware by its four parameters.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = randomUUID();

  let status = 500;
  let code: ErrorCode = "INTERNAL";
  let message = "Something went wrong";
  let details: unknown;
  let operational = false;

  if (isAppError(err)) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
    operational = true;
  } else if (err instanceof ZodError) {
    ({ status, code, message, details } = fromZod(err));
    operational = true;
  } else if (err instanceof MongooseError.ValidationError) {
    ({ status, code, message, details } = fromMongooseValidation(err));
    operational = true;
  } else if (isDuplicateKeyError(err)) {
    ({ status, code, message, details } = fromDuplicateKey(err));
    operational = true;
  } else if (err instanceof MongooseError.CastError) {
    // a malformed ObjectId in the URL — the client's fault, not ours
    status = 400;
    code = "BAD_REQUEST";
    message = `Invalid value for ${err.path}`;
    operational = true;
  }

  // operational failures are expected; anything else is a bug and gets the full stack
  if (operational) {
    console.warn(
      `[${requestId}] ${status} ${code} ${req.method} ${req.originalUrl} — ${message}`,
    );
  } else {
    console.error(
      `[${requestId}] 500 INTERNAL ${req.method} ${req.originalUrl}`,
      err instanceof Error ? err.stack : err,
    );
  }

  const body: ErrorBody = { error: { code, message, requestId } };
  if (details !== undefined) body.error.details = details;

  // development only: attach the real message so we are not debugging blind
  if (!operational && env.NODE_ENV === "development") {
    body.error.details = {
      devOnly: err instanceof Error ? err.message : String(err),
    };
  }

  res.status(status).json(body);
}

/** Registered before errorHandler; turns an unmatched route into a normal 404. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
}
