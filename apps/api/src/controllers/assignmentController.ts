import type { Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { AssignmentModel, SubmissionModel } from "../models/index.js";
import { loadAssignmentFor, loadCourseFor } from "../services/access.js";
import { AppError } from "../utils/AppError.js";
import { skipFor } from "../validation/common.js";
import type {
  CreateAssignmentInput,
  ListAssignmentsQuery,
  UpdateAssignmentInput,
} from "../validation/assignmentSchemas.js";

const log = componentLogger("assignment");

export async function createAssignment(req: Request, res: Response) {
  const course = await loadCourseFor(req, "manage");
  if (course.isArchived) throw AppError.conflict("This course is archived. Un-archive it first.");

  const input = req.body as CreateAssignmentInput;

  // a repeated title in the same course hits the unique index; errorHandler turns it into 409
  const assignment = await AssignmentModel.create({ ...input, course: course._id });

  log.info({ assignmentId: assignment.id, courseId: course.id, by: req.user!.id }, "assignment created");
  res.status(201).json({ assignment });
}

export async function listAssignments(req: Request, res: Response) {
  const course = await loadCourseFor(req, "view");
  const { page, limit, published } = req.query as unknown as ListAssignmentsQuery;
  const user = req.user!;

  // students only ever see published work, whatever they ask for
  const filter = {
    course: course._id,
    ...(user.role === "student"
      ? { isPublished: true }
      : published !== undefined
        ? { isPublished: published }
        : {}),
  };

  const [assignments, total] = await Promise.all([
    AssignmentModel.find(filter).sort({ dueAt: -1 }).skip(skipFor(page, limit)).limit(limit),
    AssignmentModel.countDocuments(filter),
  ]);

  res.json({ items: assignments, page, limit, total });
}

export async function getAssignment(req: Request, res: Response) {
  const { assignment } = await loadAssignmentFor(req, "view");
  const user = req.user!;

  const view = assignment.toJSON() as Record<string, unknown>;

  // a student also sees how many of their attempts are used
  if (user.role === "student") {
    view.yourAttempts = await SubmissionModel.countDocuments({
      assignment: assignment._id,
      student: user.id,
    });
  }

  res.json({ assignment: view });
}

export async function updateAssignment(req: Request, res: Response) {
  const { assignment, course } = await loadAssignmentFor(req, "manage");
  if (course.isArchived) throw AppError.conflict("This course is archived. Un-archive it first.");

  const input = req.body as UpdateAssignmentInput;

  // these three can't change once work exists: the detector would parse old
  // submissions with the wrong grammar, homework could become baseline-eligible
  // after the fact, or students would lose sight of what they submitted
  const locked: string[] = [];
  if (input.language !== undefined && input.language !== assignment.language) locked.push("language");
  if (input.provenance !== undefined && input.provenance !== assignment.provenance) locked.push("provenance");
  if (input.isPublished === false && assignment.isPublished) locked.push("isPublished");

  if (locked.length > 0) {
    const submitted = await SubmissionModel.exists({ assignment: assignment._id });
    if (submitted) {
      throw AppError.conflict(`Students have already submitted, so ${locked.join(", ")} can no longer change`);
    }
  }

  assignment.set(input);
  await assignment.save();

  log.info({ assignmentId: assignment.id, changes: Object.keys(input), by: req.user!.id }, "assignment updated");
  res.json({ assignment });
}
