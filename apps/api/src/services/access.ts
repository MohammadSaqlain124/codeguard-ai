import type { Request } from "express";

import type { CourseDoc } from "../models/Course.js";
import { AssignmentModel, CourseModel, SubmissionModel } from "../models/index.js";
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

// Reads :submissionId from the URL. A student may see only their own work;
// staff may see work in courses they manage. Everything else is a 404.
export async function loadSubmissionFor(req: Request) {
  const user = req.user!;
  const submission = await SubmissionModel.findById(req.params.submissionId);
  if (!submission) throw AppError.notFound("Submission");

  if (user.role === "student") {
    if (!submission.student.equals(user.id)) throw AppError.notFound("Submission");
    return submission;
  }

  const assignment = await AssignmentModel.findById(submission.assignment);
  const course = assignment ? await CourseModel.findById(assignment.course) : null;
  if (!course || !canAccessCourse(user, course, "manage")) {
    throw AppError.notFound("Submission");
  }
  return submission;
}

/**
 * Reads :submissionId for an action only staff may take, and returns the
 * assignment and course along with it.
 *
 * Separate from loadSubmissionFor for two reasons. A student must not reach
 * these actions on their own work, where loadSubmissionFor deliberately
 * lets them through. And an audit entry needs the course, which the caller
 * would otherwise have to fetch again.
 *
 * A student gets the same 404 as a stranger. Telling them "forbidden" would
 * confirm the submission exists, which is the leak the 404s here avoid.
 */
export async function loadSubmissionForManage(req: Request) {
  const user = req.user!;
  if (user.role === "student") throw AppError.notFound("Submission");

  const submission = await SubmissionModel.findById(req.params.submissionId);
  if (!submission) throw AppError.notFound("Submission");

  const assignment = await AssignmentModel.findById(submission.assignment);
  if (!assignment) throw AppError.notFound("Submission");

  const course = await CourseModel.findById(assignment.course);
  if (!course || !canAccessCourse(user, course, "manage")) {
    throw AppError.notFound("Submission");
  }
  return { submission, assignment, course };
}
