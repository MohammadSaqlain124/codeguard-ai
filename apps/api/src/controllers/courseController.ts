import type { Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import type { CourseDoc } from "../models/Course.js";
import { CourseModel, UserModel } from "../models/index.js";
import { loadCourseFor } from "../services/access.js";
import { AppError } from "../utils/AppError.js";
import { skipFor } from "../validation/common.js";
import type {
  CreateCourseInput,
  EnrolmentInput,
  ListCoursesQuery,
  UpdateCourseInput,
} from "../validation/courseSchemas.js";

const log = componentLogger("course");

// What a course looks like in a response. The roster is shown only to the
// owner and admins; everyone gets the count.
function courseView(course: CourseDoc, withRoster: boolean) {
  const json = course.toJSON() as Record<string, unknown>;
  json.studentCount = course.enrolledStudents.length;
  if (!withRoster) json.enrolledStudents = undefined;
  return json;
}

export async function createCourse(req: Request, res: Response) {
  const input = req.body as CreateCourseInput;
  const user = req.user!;

  // the route blocks students too; this keeps the handler safe on its own
  if (user.role === "student") throw AppError.forbidden();

  let facultyId = user.id;

  if (user.role === "admin") {
    if (!input.faculty) {
      throw AppError.validation("An admin must say which faculty member owns the course", [
        { field: "faculty", message: "Required when an admin creates a course" },
      ]);
    }
    const owner = await UserModel.findById(input.faculty).select("role isActive").lean();
    if (!owner || owner.role !== "faculty" || !owner.isActive) {
      throw AppError.validation("The owner must be an active faculty member", [
        { field: "faculty", message: "Not an active faculty member" },
      ]);
    }
    facultyId = input.faculty;
  } else if (input.faculty && input.faculty !== user.id) {
    throw AppError.forbidden("You can only create courses for yourself");
  }

  // a repeated code in the same year hits the unique index; errorHandler turns it into 409
  const course = await CourseModel.create({
    code: input.code,
    title: input.title,
    academicYear: input.academicYear,
    faculty: facultyId,
  });

  log.info({ courseId: course.id, code: course.code, by: user.id }, "course created");
  res.status(201).json({ course: courseView(course, true) });
}

export async function listCourses(req: Request, res: Response) {
  const { page, limit, archived, academicYear } = req.query as unknown as ListCoursesQuery;
  const user = req.user!;

  // each role sees a different slice; archived courses are hidden unless asked for
  const filter = {
    isArchived: archived ?? false,
    ...(academicYear ? { academicYear } : {}),
    ...(user.role === "faculty" ? { faculty: user.id } : {}),
    ...(user.role === "student" ? { enrolledStudents: user.id } : {}),
  };

  const [courses, total] = await Promise.all([
    CourseModel.find(filter)
      .sort({ academicYear: -1, code: 1 })
      .skip(skipFor(page, limit))
      .limit(limit),
    CourseModel.countDocuments(filter),
  ]);

  res.json({ items: courses.map((c) => courseView(c, false)), page, limit, total });
}

export async function getCourse(req: Request, res: Response) {
  const course = await loadCourseFor(req, "view");
  const user = req.user!;

  const withRoster = user.role === "admin" || course.faculty.equals(user.id);
  res.json({ course: courseView(course, withRoster) });
}

export async function updateCourse(req: Request, res: Response) {
  const course = await loadCourseFor(req, "manage");
  const input = req.body as UpdateCourseInput;

  if (input.title !== undefined) course.title = input.title;
  if (input.isArchived !== undefined) course.isArchived = input.isArchived;

  // save() writes only the changed fields, so this can't undo a parallel enrolment
  await course.save();

  log.info({ courseId: course.id, changes: input, by: req.user!.id }, "course updated");
  res.json({ course: courseView(course, true) });
}

export async function enrolStudents(req: Request, res: Response) {
  const course = await loadCourseFor(req, "manage");
  if (course.isArchived) throw AppError.conflict("This course is archived. Un-archive it first.");

  const { rollNos } = req.body as EnrolmentInput;

  // only active students can be enrolled; anything else is reported, not added
  const students = await UserModel.find({ rollNo: { $in: rollNos }, role: "student", isActive: true })
    .select("_id rollNo")
    .lean();

  const found = new Set(students.map((s) => s.rollNo));
  const notFound = rollNos.filter((r) => !found.has(r));
  const ids = students.map((s) => s._id);
  const already = ids.filter((id) => course.enrolledStudents.some((e) => e.equals(id))).length;

  // $addToSet adds each id only if it's missing, in one atomic step
  if (ids.length > 0) {
    await CourseModel.updateOne({ _id: course._id }, { $addToSet: { enrolledStudents: { $each: ids } } });
  }

  log.info({ courseId: course.id, added: ids.length - already, notFound: notFound.length, by: req.user!.id }, "students enrolled");
  res.json({ added: ids.length - already, alreadyEnrolled: already, notFound });
}

export async function removeStudents(req: Request, res: Response) {
  const course = await loadCourseFor(req, "manage");
  if (course.isArchived) throw AppError.conflict("This course is archived. Un-archive it first.");

  const { rollNos } = req.body as EnrolmentInput;

  // no role or isActive filter here: a deactivated student must still be removable
  const users = await UserModel.find({ rollNo: { $in: rollNos } }).select("_id rollNo").lean();

  const found = new Set(users.map((u) => u.rollNo));
  const notFound = rollNos.filter((r) => !found.has(r));
  const ids = users.map((u) => u._id);
  const wasEnrolled = ids.filter((id) => course.enrolledStudents.some((e) => e.equals(id))).length;

  // submissions are evidence, so removing a student never touches them
  if (ids.length > 0) {
    await CourseModel.updateOne({ _id: course._id }, { $pull: { enrolledStudents: { $in: ids } } });
  }

  log.info({ courseId: course.id, removed: wasEnrolled, by: req.user!.id }, "students removed");
  res.json({ removed: wasEnrolled, notEnrolled: ids.length - wasEnrolled, notFound });
}
