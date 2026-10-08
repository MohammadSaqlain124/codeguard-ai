import { Router } from "express";

import {
  createAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
} from "../controllers/assignmentController.js";
import { listResults } from "../controllers/resultController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  assignmentIdParams,
  createAssignmentSchema,
  listAssignmentsQuery,
  updateAssignmentSchema,
} from "../validation/assignmentSchemas.js";
import { courseIdParams } from "../validation/courseSchemas.js";
import { listResultsQuery } from "../validation/resultSchemas.js";
import { assignmentSubmissionRouter } from "./submissionRoutes.js";

// same meaning as in courseRoutes.ts: re-check the account, then the role
const staff = [requireActiveUser, requireRole("faculty", "admin")];

// Mounted inside courseRouter at /:courseId/assignments. courseRouter has
// already checked the token. mergeParams lets this router read :courseId,
// which belongs to the parent's path, not this one.
export const courseAssignmentRouter = Router({ mergeParams: true });

courseAssignmentRouter.get(
  "/",
  validateParams(courseIdParams),
  validateQuery(listAssignmentsQuery),
  listAssignments,
);
courseAssignmentRouter.post(
  "/",
  ...staff,
  validateParams(courseIdParams),
  validateBody(createAssignmentSchema),
  createAssignment,
);

// Mounted in app.ts at /api/assignments
export const assignmentRouter = Router();

assignmentRouter.use(requireAuth);

assignmentRouter.get("/:assignmentId", validateParams(assignmentIdParams), getAssignment);
assignmentRouter.patch(
  "/:assignmentId",
  ...staff,
  validateParams(assignmentIdParams),
  validateBody(updateAssignmentSchema),
  updateAssignment,
);

// The review queue. Staff only, which loadAssignmentFor's "manage" enforces,
// so a student asking for it gets the same 404 as a stranger.
assignmentRouter.get(
  "/:assignmentId/results",
  validateParams(assignmentIdParams),
  validateQuery(listResultsQuery),
  listResults,
);

// submissions to an assignment; requireAuth above already covers them
assignmentRouter.use("/:assignmentId/submissions", assignmentSubmissionRouter);
