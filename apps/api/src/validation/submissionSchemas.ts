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
