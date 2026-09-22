import { Router } from "express";

import {
  createAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
} from "../controllers/assignmentController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  assignmentIdParams,
  createAssignmentSchema,
  listAssignmentsQuery,
  updateAssignmentSchema,
} from "../validation/assignmentSchemas.js";
import { courseIdParams } from "../validation/courseSchemas.js";

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
