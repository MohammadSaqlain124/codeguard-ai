import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { type Role } from "../models/index.js";
import { AppError } from "./AppError.js";

export const TOKEN_TYPES = ["access", "refresh"] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

/** Symmetric signing: only our API signs and verifies, so there is no key to distribute. */
const ALGORITHM = "HS256" as const;

export interface TokenClaims {
  /** user id — "sub" is the registered claim name for the subject */
  sub: string;
  role: Role;
  /** which kind of token this is; checked on verify to stop type confusion */
  type: TokenType;
  /** unique id for this token, so a refresh token can be revoked by id */
  jti: string;
}

interface SignInput {
  userId: string;
  role: Role;
}

export function signAccessToken({ userId, role }: SignInput): string {
  return jwt.sign({ role, type: "access" satisfies TokenType }, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    jwtid: randomUUID(),
    expiresIn: env.JWT_ACCESS_EXPIRY,
    issuer: "codeguard-api",
    audience: "codeguard-client",
  } as jwt.SignOptions);
}

export function signRefreshToken({ userId, role }: SignInput): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ role, type: "refresh" satisfies TokenType }, env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    jwtid: jti,
    expiresIn: env.JWT_REFRESH_EXPIRY,
    issuer: "codeguard-api",
    audience: "codeguard-client",
  } as jwt.SignOptions);
  // the caller stores the jti so this token can be revoked on logout
  return { token, jti };
}

function verify(token: string, secret: string, expected: TokenType): TokenClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret, {
      // pinning the algorithm is what blocks alg:none and HS/RS confusion
      algorithms: [ALGORITHM],
      issuer: "codeguard-api",
      audience: "codeguard-client",
    });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw AppError.tokenExpired();
    throw AppError.tokenInvalid();
  }

  if (typeof decoded !== "object" || decoded === null) throw AppError.tokenInvalid();

  const claims = decoded as Partial<TokenClaims>;
  // a refresh token must never be accepted where an access token is required
  if (claims.type !== expected) throw AppError.tokenInvalid();
  if (!claims.sub || !claims.role || !claims.jti) throw AppError.tokenInvalid();

  return { sub: claims.sub, role: claims.role, type: claims.type, jti: claims.jti };
}

export function verifyAccessToken(token: string): TokenClaims {
  return verify(token, env.JWT_ACCESS_SECRET, "access");
}

export function verifyRefreshToken(token: string): TokenClaims {
  return verify(token, env.JWT_REFRESH_SECRET, "refresh");
}

/** Pulls the token out of "Authorization: Bearer <token>". */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
