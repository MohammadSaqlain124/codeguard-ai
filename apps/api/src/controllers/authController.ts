import type { Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { isRefreshTokenRevoked, revokeRefreshToken } from "../db/redis.js";
import { UserModel } from "../models/index.js";
import { recordAudit, type AuditAction } from "../services/audit.js";
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
  UpdateUserInput,
  UserIdParams,
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

  // The state change first, then the audit entry — see File 019 on
  // transactions. Through recordAudit rather than AuditLogModel.create,
  // which is what this did until now: the account has already been created
  // at this point, so a failed audit write threw and turned a successful
  // creation into a 500 the caller could not undo. That is the exact failure
  // recordAudit was written to prevent, and this was the one place in the
  // codebase still going around it.
  //
  // The action is user.created, not user.role_changed. Nothing changed: an
  // account came into existence with a role. An entry saying a role changed,
  // with before: null, reads to anyone auditing it as a privilege escalation
  // that never happened.
  const audited = await recordAudit({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.created",
    targetType: "User",
    targetId: user.id,
    changes: { before: null, after: { role, isActive: user.isActive } },
    reason: `Account created with role ${role}`,
  });

  log.info({ userId: user.id, role, by: actor.id, audited }, "user created");
  res.status(201).json({ user, audited });
}

/**
 * Changes somebody else's role or disables their account.
 *
 * isActive was enforced everywhere and settable nowhere: requireActiveUser
 * checks it on every write, login refuses on it and refresh refuses on it,
 * and nothing in the system could ever set it to false. A departed or
 * compromised account could not be shut off.
 *
 * A deactivation takes effect on the next request that passes through
 * requireActiveUser, which re-reads the account, rather than waiting for the
 * access token to expire.
 */
export async function updateUser(req: Request, res: Response) {
  const actor = req.user!;
  const { userId } = req.params as unknown as UserIdParams;
  const input = req.body as UpdateUserInput;

  // An admin demoting themselves or switching their own account off is the
  // one move that can lock the last administrator out, and there would be no
  // endpoint left to undo it with. Cheaper to refuse than to recover from.
  if (userId === actor.id) {
    throw AppError.forbidden("Change another administrator's account, not your own");
  }

  const user = await UserModel.findById(userId);
  if (!user) throw AppError.notFound("User");

  const before = { role: user.role, isActive: user.isActive };

  if (input.isActive !== undefined) user.isActive = input.isActive;

  if (input.role !== undefined && input.role !== user.role) {
    // createUserSchema states the invariant that students have a roll number
    // and nobody else does. A role change is the only other thing that can
    // break it, so it is held here too rather than left to drift.
    if (input.role === "student") {
      const next = input.rollNo ?? user.rollNo;
      if (!next) {
        throw AppError.validation("A roll number is required for students", [
          { field: "rollNo", message: "Required when the new role is student" },
        ]);
      }
      user.rollNo = next;
    } else {
      // Nothing an admin could supply instead, and leaving it would make a
      // faculty member who still holds a roll number.
      user.set("rollNo", undefined);
    }
    user.role = input.role;
  }

  const changed = user.modifiedPaths();
  if (changed.length === 0) {
    // asked for exactly what is already true; nothing to write or record
    return res.json({ user, audited: [] });
  }

  await user.save();
  const after = { role: user.role, isActive: user.isActive };

  // One entry per decision, not per request. AUDIT_ACTIONS names what somebody
  // decided, so an admin who demotes and disables in one call made two of
  // them and a reviewer should see both.
  const actions: AuditAction[] = [];
  if (changed.includes("role")) actions.push("user.role_changed");
  if (changed.includes("isActive")) {
    actions.push(user.isActive ? "user.reactivated" : "user.deactivated");
  }

  // After the save, so none of these can report a change that did not land.
  const audited: AuditAction[] = [];
  for (const action of actions) {
    const ok = await recordAudit({
      actor: actor.id,
      actorRole: actor.role,
      action,
      targetType: "User",
      targetId: user.id,
      changes: { before, after },
      reason: input.reason,
    });
    if (ok) audited.push(action);
  }

  log.info({ userId: user.id, changed, by: actor.id, audited }, "user updated");
  res.json({ user, audited });
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
    throw AppError.tokenInvalid("Refresh token is invalid or has expired");
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
