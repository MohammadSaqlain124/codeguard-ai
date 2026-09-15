import bcrypt from "bcrypt";

import { AppError } from "./AppError.js";

/**
 * Work factor. Each increment doubles the time.
 * 12 is roughly 250ms on modern hardware — imperceptible on login,
 * and about ten million times slower than SHA-256 for an attacker.
 */
const COST_FACTOR = 12;

/** bcrypt silently truncates input beyond 72 bytes, so reject it instead. */
const MAX_PASSWORD_BYTES = 72;

const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw AppError.validation(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  // length in *bytes*, not characters — an emoji is four
  if (Buffer.byteLength(plain, "utf8") > MAX_PASSWORD_BYTES) {
    throw AppError.validation(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  return bcrypt.hash(plain, COST_FACTOR);
}

/**
 * Returns false rather than throwing on a malformed hash, so a corrupted
 * record cannot be distinguished from a wrong password by the caller.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Runs a comparison against a throwaway hash so an unknown email costs
 * the same time as a wrong password. Without this, response timing
 * reveals which emails are registered.
 */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-equalisation", COST_FACTOR);

export async function fakeVerify(): Promise<false> {
  await bcrypt.compare("anything", DUMMY_HASH);
  return false;
}

/** True when a stored hash was produced at a lower cost factor than we now use. */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < COST_FACTOR;
  } catch {
    return true;
  }
}
