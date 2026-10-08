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
