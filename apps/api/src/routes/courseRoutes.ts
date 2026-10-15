import { Router } from "express";

import { getConfig, updateConfig } from "../controllers/configController.js";
import {
  createCourse,
  enrolStudents,
  getCourse,
  listCourses,
  removeStudents,
  updateCourse,
} from "../controllers/courseController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { updateConfigSchema } from "../validation/configSchemas.js";
import {
  courseIdParams,
  createCourseSchema,
  enrolmentSchema,
  listCoursesQuery,
  updateCourseSchema,
} from "../validation/courseSchemas.js";
import { courseAssignmentRouter } from "./assignmentRoutes.js";

export const courseRouter = Router();

// every course route needs a signed-in user
courseRouter.use(requireAuth);

// writes also re-check the account in the database (a deactivated faculty
// member's token would otherwise work for up to 15 minutes); it must run
// before requireRole because it corrects a stale role
const staff = [requireActiveUser, requireRole("faculty", "admin")];

// reads: any role; the controller decides what each role sees
courseRouter.get("/", validateQuery(listCoursesQuery), listCourses);
courseRouter.get("/:courseId", validateParams(courseIdParams), getCourse);

// writes: staff only, checked before the body is looked at
courseRouter.post("/", ...staff, validateBody(createCourseSchema), createCourse);
courseRouter.patch(
  "/:courseId",
  ...staff,
  validateParams(courseIdParams),
  validateBody(updateCourseSchema),
  updateCourse,
);
courseRouter.post(
  "/:courseId/students",
  ...staff,
  validateParams(courseIdParams),
  validateBody(enrolmentSchema),
  enrolStudents,
);

// POST rather than DELETE: some clients and proxies drop a DELETE request's body
courseRouter.post(
  "/:courseId/students/remove",
  ...staff,
  validateParams(courseIdParams),
  validateBody(enrolmentSchema),
  removeStudents,
);

// The detection settings. Staff only on the read as well as the write, unlike
// every other course read: the review threshold tells a student exactly how
// much copying stays out of the queue.
courseRouter.get("/:courseId/config", ...staff, validateParams(courseIdParams), getConfig);
courseRouter.patch(
  "/:courseId/config",
  ...staff,
  validateParams(courseIdParams),
  validateBody(updateConfigSchema),
  updateConfig,
);

// assignments within a course; requireAuth above already covers them
courseRouter.use("/:courseId/assignments", courseAssignmentRouter);
