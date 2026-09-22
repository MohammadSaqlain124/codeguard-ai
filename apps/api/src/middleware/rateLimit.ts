import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { redis } from "../db/redis.js";
import { AppError } from "../utils/AppError.js";

const log = componentLogger("rate-limit");

type Rule = {
  // part of the Redis key, so each rule counts separately
  name: string;
  limit: number;
  windowSeconds: number;
  // what to count by; undefined means the rule doesn't apply to this request
  keyFor: (req: Request) => string | undefined;
};

// the same email or IP always gives the same key, without storing the value itself
function hashed(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function rateLimit(rule: Rule) {
  return async function limiter(req: Request, res: Response, next: NextFunction) {
    const id = rule.keyFor(req);
    if (!id) return next();

    const key = `rl:${rule.name}:${id}`;
    let count: number;
    let ttl: number;

    try {
      // one round trip, run as a unit: count this request, start the window
      // clock only if it isn't running (NX), and read how long is left
      const results = await redis
        .multi()
        .incr(key)
        .expire(key, rule.windowSeconds, "NX")
        .ttl(key)
        .exec();
      if (!results) throw new Error("rate limit transaction was aborted");
      count = results[0][1] as number;
      ttl = results[2][1] as number;
    } catch (err) {
      // fail open: a Redis outage must not lock everyone out
      log.error({ err, rule: rule.name }, "rate limiter unavailable, request allowed");
      return next();
    }

    if (count > rule.limit) {
      const retryAfter = ttl > 0 ? ttl : rule.windowSeconds;
      res.setHeader("Retry-After", String(retryAfter));
      log.warn({ rule: rule.name, count }, "rate limit exceeded");
      return next(AppError.tooManyRequests(retryAfter));
    }

    next();
  };
}

const MINUTE = 60;

// Keyed by the email being tried, not the IP: a whole lab can share one
// public IP, and one student's typos must not lock out their classmates.
export const loginPerEmail = rateLimit({
  name: "login-email",
  limit: 10,
  windowSeconds: 15 * MINUTE,
  keyFor: (req) =>
    typeof req.body?.email === "string" ? hashed(req.body.email.trim().toLowerCase()) : undefined,
});

// a generous backstop against one machine trying many accounts
export const loginPerIp = rateLimit({
  name: "login-ip",
  limit: 300,
  windowSeconds: 15 * MINUTE,
  keyFor: (req) => (req.ip ? hashed(req.ip) : undefined),
});

// high enough for a whole class registering in the same lab
export const registerPerIp = rateLimit({
  name: "register-ip",
  limit: 100,
  windowSeconds: 60 * MINUTE,
  keyFor: (req) => (req.ip ? hashed(req.ip) : undefined),
});

export const refreshPerIp = rateLimit({
  name: "refresh-ip",
  limit: 60,
  windowSeconds: 15 * MINUTE,
  keyFor: (req) => (req.ip ? hashed(req.ip) : undefined),
});

// runs after requireAuth, so the user id is known
export const uploadPerUser = rateLimit({
  name: "upload-user",
  limit: 10,
  windowSeconds: 10 * MINUTE,
  keyFor: (req) => req.user?.id,
});
