import type { Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { isRefreshTokenRevoked, revokeRefreshToken } from "../db/redis.js";
import { AuditLogModel, UserModel } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { fakeVerify, hashPassword, verifyPassword } from "../utils/password.js";
import type {
  CreateUserInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
} from "../validation/authSchemas.js";

const log = componentLogger("auth");

/** Seconds a refresh token stays revocable — matches JWT_REFRESH_EXPIRY of 7d. */
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

function tokensFor(userId: string, role: "student" | "faculty" | "admin") {
  const accessToken = signAccessToken({ userId, role });
  const { token: refreshToken } = signRefreshToken({ userId, role });
  return { accessToken, refreshToken };
}

/** Public registration. Role is set here, never taken from input. */
export async function register(req: Request, res: Response) {
  const { email, password, name, rollNo } = req.body as RegisterInput;

  // hashed here because File 020 deliberately has no pre("save") hook
  const passwordHash = await hashPassword(password);

  const user = await UserModel.create({
    email,
    passwordHash,
    name,
    rollNo,
    role: "student",
  });

  log.info({ userId: String(user._id) }, "user registered");

  const tokens = tokensFor(String(user._id), "student");
  res.status(201).json({ user, ...tokens });
}

/** Admin-only account creation, where choosing a role is the point. */
export async function createUser(req: Request, res: Response) {
  const { email, password, name, role, rollNo } = req.body as CreateUserInput;
  const actor = req.user!;

  const passwordHash = await hashPassword(password);
  const user = await UserModel.create({ email, passwordHash, name, role, rollNo });

  // the state change first, then the audit entry — see File 019 on transactions
  await AuditLogModel.create({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.role_changed",
    targetType: "User",
    targetId: user._id,
    changes: { before: null, after: { role } },
    reason: `Account created with role ${role}`,
  });

  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  const user = await UserModel.findOne({ email }).select("+passwordHash");

  if (!user) {
    // burn the same ~250ms so an unknown email is indistinguishable by timing
    await fakeVerify();
    throw AppError.unauthenticated();
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    log.warn({ userId: String(user._id) }, "failed login");
    throw AppError.unauthenticated();
  }

  if (!user.isActive) {
    // same message as a wrong password: never confirm an account exists
    throw AppError.unauthenticated();
  }

  const tokens = tokensFor(String(user._id), user.role);
  log.info({ userId: String(user._id), role: user.role }, "login");

  // the toJSON plugin strips passwordHash, so this is safe to send
  res.json({ user, ...tokens });
}

/**
 * Exchanges a refresh token for a new pair, revoking the old one.
 * Rotation means a stolen token is usable once, and its reuse is detectable.
 */
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as RefreshInput;

  const claims = verifyRefreshToken(refreshToken);

  if (await isRefreshTokenRevoked(claims.jti)) {
    // either a logged-out token or a replay of a rotated one
    log.warn({ userId: claims.sub, jti: claims.jti }, "revoked refresh token presented");
    throw AppError.tokenInvalid();
  }

  const user = await UserModel.findById(claims.sub).select("role isActive").lean();
  if (!user || !user.isActive) {
    throw AppError.unauthenticated();
  }

  await revokeRefreshToken(claims.jti, REFRESH_TTL_SECONDS);

  // the role is re-read, so a demotion takes effect at the next refresh
  const tokens = tokensFor(claims.sub, user.role);
  res.json(tokens);
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as RefreshInput;

  try {
    const claims = verifyRefreshToken(refreshToken);
    await revokeRefreshToken(claims.jti, REFRESH_TTL_SECONDS);
    log.info({ userId: claims.sub }, "logout");
  } catch {
    // an invalid token means there is nothing to revoke; logout still succeeds
  }

  res.status(204).send();
}

/** Returns the current user, from the token's subject. */
export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw AppError.unauthenticated();
  res.json({ user });
}
