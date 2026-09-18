import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/** Which part of the request to validate. */
type Source = "body" | "query" | "params";

/**
 * Parses one part of the request against a schema and replaces it with the
 * result, so the controller receives normalised, typed data.
 * A ZodError is thrown and handled centrally by errorHandler.
 */
export function validate(schema: ZodType, source: Source = "body") {
  return function validator(req: Request, _res: Response, next: NextFunction) {
    const parsed = schema.safeParse(req[source]);

    if (!parsed.success) {
      // errorHandler translates ZodError into 400 VALIDATION_FAILED with a field list
      return next(parsed.error);
    }

    if (source === "body") {
      req.body = parsed.data;
    } else {
      // req.query and req.params are getter-only in Express 5, so mutate in place
      Object.assign(req[source], parsed.data);
    }

    next();
  };
}

/** Convenience wrappers, so a route reads validateQuery(schema) rather than validate(schema, "query"). */
export const validateBody = (schema: ZodType) => validate(schema, "body");
export const validateQuery = (schema: ZodType) => validate(schema, "query");
export const validateParams = (schema: ZodType) => validate(schema, "params");
