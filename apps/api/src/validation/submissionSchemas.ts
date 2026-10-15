import { z } from "zod";

import { SUBMISSION_STATUS } from "../models/Submission.js";
import { objectId, pagination, queryBoolean } from "./common.js";

export const submissionIdParams = z.object({ submissionId: objectId }).strict();

// student and late are staff filters; the controller ignores student for students
export const listSubmissionsQuery = z
  .object({
    ...pagination,
    status: z.enum(SUBMISSION_STATUS).optional(),
    student: objectId.optional(),
    late: queryBoolean.optional(),
  })
  .strict();

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuery>;

// A nomination overrides the automatic rule, so the reason is required in
// both directions. Ten characters is low enough not to be an obstacle and
// high enough to refuse "ok" and ".". The 2000 cap matches AuditLog.reason.
export const nominateBody = z
  .object({
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();

export type NominateBody = z.infer<typeof nominateBody>;

// Re-running detection replaces a stored result with a new revision, so the
// reason is required for the same cause a nomination's is: the old score stays
// in the history and somebody later has to be able to tell why it was
// superseded. Same shape as nominateBody rather than a reuse of it, because
// these are different decisions and only coincidentally the same fields today.
export const rerunBody = z
  .object({
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();

export type RerunBody = z.infer<typeof rerunBody>;
