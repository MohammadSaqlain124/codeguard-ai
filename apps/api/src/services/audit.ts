import type { Types } from "mongoose";

import { componentLogger } from "../config/logger.js";
import { AUDIT_ACTIONS, AUDIT_TARGETS, AuditLogModel } from "../models/AuditLog.js";

const log = componentLogger("audit");

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTarget = (typeof AUDIT_TARGETS)[number];

// handlers hold ids as strings, documents hold them as ObjectIds, and
// mongoose casts either one on the way in
type IdLike = string | Types.ObjectId;

export type AuditEntry = {
  actor: IdLike;
  // the schema stores this rather than looking it up later, so a role
  // change next term does not rewrite what happened this term
  actorRole: string;
  action: AuditAction;
  targetType: AuditTarget;
  targetId: IdLike;
  course?: IdLike;
  changes?: { before?: unknown; after?: unknown };
  reason?: string;
};

/**
 * Writes one audit entry. Returns true if it was written.
 *
 * Never throws, and that is a deliberate trade. The entry is written after
 * the thing it describes has already happened. Throwing here would turn a
 * successful nomination into a 500, and the caller would have no way to
 * undo the part that worked. So the write is best effort, the failure is
 * logged loudly, and the caller reports whether it landed.
 *
 * The cost is honest: a failed audit write means a state change with no
 * record of who made it. That is bad, which is why it is logged at error
 * level rather than swallowed.
 */
export async function recordAudit(entry: AuditEntry): Promise<boolean> {
  try {
    await AuditLogModel.create({ ...entry, at: new Date() });
    return true;
  } catch (err) {
    log.error(
      { err, action: entry.action, targetType: entry.targetType, targetId: String(entry.targetId) },
      "audit entry was NOT written",
    );
    return false;
  }
}
