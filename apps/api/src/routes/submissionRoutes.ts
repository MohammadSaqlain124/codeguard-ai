import { Router } from "express";

import { getResult, reviewResult } from "../controllers/resultController.js";
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
import { resultRevisionQuery, reviewBody } from "../validation/resultSchemas.js";
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

// The evidence behind one score. Staff only, enforced inside the controller
// by loadSubmissionForManage rather than by a role guard here, so that a
// student reaches a 404 and not a 403: a 403 would confirm the submission
// exists, which is the leak the access layer's 404s avoid.
submissionRouter.get(
  "/:submissionId/result",
  validateParams(submissionIdParams),
  validateQuery(resultRevisionQuery),
  getResult,
);

// Recording a decision about a student is at least as consequential as a
// nomination, so it carries the same guards: re-check the account, then the
// role, before the body is looked at.
submissionRouter.patch(
  "/:submissionId/review",
  requireActiveUser,
  requireRole("faculty", "admin"),
  validateParams(submissionIdParams),
  validateBody(reviewBody),
  reviewResult,
);

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
