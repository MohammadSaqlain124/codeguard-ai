import { Router } from "express";

import {
  createSubmission,
  downloadSubmission,
  getSubmissionDetails,
  listSubmissions,
} from "../controllers/submissionController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { uploadSourceFile } from "../middleware/upload.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { assignmentIdParams } from "../validation/assignmentSchemas.js";
import { listSubmissionsQuery, submissionIdParams } from "../validation/submissionSchemas.js";

// Mounted inside assignmentRouter at /:assignmentId/submissions, which has
// already checked the token. mergeParams lets this router read :assignmentId.
export const assignmentSubmissionRouter = Router({ mergeParams: true });

// Order matters: who you are and whether the id is valid are checked before
// the upload is read, so no one can make the server buffer a file for nothing.
assignmentSubmissionRouter.post(
  "/",
  requireActiveUser,
  requireRole("student"),
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
