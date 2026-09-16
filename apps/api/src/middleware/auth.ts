import type { NextFunction, Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { UserModel, type Role } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { extractBearerToken, verifyAccessToken } from "../utils/jwt.js";

const log = componentLogger("auth");

/** Adds req.user to Express's Request type across the whole project. */
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

/**
 * Verifies the access token and attaches req.user.
 * Does NOT hit the database — the claims are trusted for the token's 15-minute life.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(AppError.unauthenticated());
  }

  // verifyAccessToken throws AppError.tokenExpired or tokenInvalid
  const claims = verifyAccessToken(token);
  req.user = { id: claims.sub, role: claims.role };
  next();
}

/**
 * Attaches req.user when a valid token is present, and does nothing otherwise.
 * For endpoints whose response differs for a signed-in user but does not require one.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next();
  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
  } catch {
    // a bad token on an optional route is treated as no token
  }
  next();
}

/**
 * Allows the request only if req.user.role is one of the listed roles.
 * Must be registered after requireAuth.
 */
export function requireRole(...allowed: Role[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) {
      // a programming error, not a client error — requireAuth was not registered
      return next(new Error("requireRole used without requireAuth"));
    }
    if (!allowed.includes(req.user.role)) {
      log.warn(
        { userId: req.user.id, role: req.user.role, allowed, url: req.originalUrl },
        "role check failed",
      );
      return next(AppError.forbidden());
    }
    next();
  };
}

/**
 * Re-reads the user and rejects deactivated accounts.
 * Costs one query, so it is used only on routes where a stale token matters.
 */
export async function requireActiveUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new Error("requireActiveUser used without requireAuth"));
  }

  const user = await UserModel.findById(req.user.id).select("role isActive").lean();

  if (!user || !user.isActive) {
    log.warn({ userId: req.user.id }, "token valid but account inactive or missing");
    return next(AppError.unauthenticated());
  }

  // the role may have changed since the token was issued
  if (user.role !== req.user.role) {
    log.warn(
      { userId: req.user.id, tokenRole: req.user.role, currentRole: user.role },
      "role in token is stale",
    );
    req.user.role = user.role;
  }

  next();
}
