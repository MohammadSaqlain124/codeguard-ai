import type { Request } from "express";

import type { CourseDoc } from "../models/Course.js";
import { AssignmentModel, CourseModel } from "../models/index.js";
import { AppError } from "../utils/AppError.js";

export type Access = "view" | "manage";

type SignedInUser = NonNullable<Request["user"]>;

// Admins can do anything, the owning faculty member can view and manage,
// and enrolled students can only view.
export function canAccessCourse(user: SignedInUser, course: CourseDoc, access: Access) {
  if (user.role === "admin") return true;
  if (course.faculty.equals(user.id)) return true;
  if (access === "manage") return false;
  return course.enrolledStudents.some((s) => s.equals(user.id));
}

// Reads :courseId from the URL. A course the user may not touch gets the
// same 404 as one that doesn't exist, so ids can't be probed.
export async function loadCourseFor(req: Request, access: Access) {
  const course = await CourseModel.findById(req.params.courseId);
  if (!course || !canAccessCourse(req.user!, course, access)) {
    throw AppError.notFound("Course");
  }
  return course;
}

// Reads :assignmentId from the URL. Access follows the assignment's course,
// and students never see an assignment that isn't published.
export async function loadAssignmentFor(req: Request, access: Access) {
  const user = req.user!;
  const assignment = await AssignmentModel.findById(req.params.assignmentId);
  if (!assignment) throw AppError.notFound("Assignment");

  const course = await CourseModel.findById(assignment.course);
  const hidden = user.role === "student" && !assignment.isPublished;

  if (!course || hidden || !canAccessCourse(user, course, access)) {
    throw AppError.notFound("Assignment");
  }
  return { assignment, course };
}
