import pino from "pino";

import { env } from "./env.js";

const isDev = env.NODE_ENV === "development";

/**
 * Paths whose values are replaced with [Redacted] before writing.
 * Add to this list rather than remembering not to log something.
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "password",
  "newPassword",
  "currentPassword",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "body.password",
  "body.newPassword",
  "body.currentPassword",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
  // ISO timestamps rather than epoch millis, so log lines are readable unaided
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "codeguard-api" },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" },
        },
      }
    : {}),
});

/** A child logger tags every line with a component, without repeating the field. */
export function componentLogger(component: string) {
  return logger.child({ component });
}
