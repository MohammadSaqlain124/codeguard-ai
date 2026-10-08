import { z } from "zod";

import { REVIEW_STATUS } from "../models/DetectionResult.js";
import { objectId, pagination } from "./common.js";

// The review queue is a ranking, so the filters that matter are "which ones
// has nobody looked at" and "show me the top". Anything finer belongs in the
// client, which already has the page.
export const listResultsQuery = z
  .object({
    ...pagination,
    reviewStatus: z.enum(REVIEW_STATUS).optional(),
    minRps: z.coerce.number().min(0).max(1).optional(),
  })
  .strict();

export type ListResultsQuery = z.infer<typeof listResultsQuery>;

// Results are versioned rather than overwritten, so a reader can ask for an
// earlier revision. Omitting it gives the current one.
export const resultRevisionQuery = z
  .object({
    revision: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export type ResultRevisionQuery = z.infer<typeof resultRevisionQuery>;

export const resultIdParams = z.object({ resultId: objectId }).strict();

// The four states a reviewer can move a result INTO. "pending" is absent on
// purpose: AUDIT_ACTIONS carries result.dismissed, result.escalated,
// result.confirmed_clean and result.contested but no result.pending, so
// reopening to pending would be a state change with no audit action, and the
// review history is meant to be append-only even though the state is not.
export const REVIEW_DECISIONS = [
  "dismissed",
  "contested",
  "escalated",
  "confirmed_clean",
] as const;

// The note is required, in every direction, for the reason nominateBody gives:
// a decision recorded about a student should carry its justification. Ten
// characters refuses "ok" and "."; 2000 matches both review.note and the
// audit entry's reason field.
export const reviewBody = z
  .object({
    status: z.enum(REVIEW_DECISIONS),
    note: z.string().trim().min(10).max(2000),
  })
  .strict();

export type ReviewBody = z.infer<typeof reviewBody>;
