import { Router } from "express";

import {
  createSubmission,
  downloadSubmission,
  getSubmissionDetails,
  listSubmissions,
  nominateSubmission,
  withdrawNomination,
} from "../controllers/submissionController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { uploadPerUser } from "../middleware/rateLimit.js";
import { uploadSourceFile } from "../middleware/upload.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { assignmentIdParams } from "../validation/assignmentSchemas.js";
import {
  listSubmissionsQuery,
  nominateBody,
  submissionIdParams,
} from "../validation/submissionSchemas.js";

// Mounted inside assignmentRouter at /:assignmentId/submissions, which has
// already checked the token. mergeParams lets this router read :assignmentId.
export const assignmentSubmissionRouter = Router({ mergeParams: true });

// Order matters: who you are, how often you've tried, and whether the id is
// valid are all checked before the upload is read.
assignmentSubmissionRouter.post(
  "/",
  requireActiveUser,
  requireRole("student"),
  uploadPerUser,
  validateParams(assignmentIdParams),
  uploadSourceFile,
  createSubmission,
);
assignmentSubmissionRouter.get(
  "/",
  validateParams(assignmentIdParams),
  validateQuery(listSubmissionsQuery),
  listSubmissions,
);

// Mounted in app.ts at /api/submissions
export const submissionRouter = Router();

submissionRouter.use(requireAuth);

submissionRouter.get("/:submissionId", validateParams(submissionIdParams), getSubmissionDetails);
submissionRouter.get("/:submissionId/file", validateParams(submissionIdParams), downloadSubmission);

// Nomination changes what a student's baseline is built from, so it costs
// the extra query requireActiveUser makes: a revoked faculty account must
// not keep nominating for the fifteen minutes its token stays valid.
submissionRouter.post(
  "/:submissionId/nominate",
  requireActiveUser,
  requireRole("faculty", "admin"),
  validateParams(submissionIdParams),
  validateBody(nominateBody),
  nominateSubmission,
);
submissionRouter.delete(
  "/:submissionId/nominate",
  requireActiveUser,
  requireRole("faculty", "admin"),
  validateParams(submissionIdParams),
  validateBody(nominateBody),
  withdrawNomination,
);
