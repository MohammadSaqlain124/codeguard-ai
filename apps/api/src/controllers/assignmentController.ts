import type { Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { AssignmentModel, SubmissionModel } from "../models/index.js";
import { loadAssignmentFor, loadCourseFor } from "../services/access.js";
import { recordAudit } from "../services/audit.js";
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

  // read before set(), because after it the old value is gone
  const provenanceBefore = assignment.provenance;

  assignment.set(input);
  // what really changed, not just what was sent: Mongoose ignores a value set to itself
  const changed = assignment.modifiedPaths();
  await assignment.save();

  // Provenance decides whether this assignment's work can anchor a student's
  // behavioural baseline, so moving a take-home to invigilated turns ordinary
  // homework into evidence of how that student writes. AUDIT_ACTIONS has
  // reserved assignment.provenance_changed since File 026 and nothing had ever
  // written one, which left the one trust-affecting edit on this route
  // recorded in a log line and nowhere else.
  //
  // Only this field. A changed title or due date is not a claim about anybody,
  // and there is no audit action for one.
  const user = req.user!;
  let audited: boolean | undefined;
  if (changed.includes("provenance")) {
    // after the save, so it cannot report a change that did not land
    audited = await recordAudit({
      actor: user.id,
      actorRole: user.role,
      action: "assignment.provenance_changed",
      targetType: "Assignment",
      targetId: assignment.id,
      course: course.id,
      changes: {
        before: { provenance: provenanceBefore },
        after: { provenance: assignment.provenance },
      },
    });
  }

  log.info(
    { assignmentId: assignment.id, changes: changed, by: user.id, audited },
    "assignment updated",
  );
  res.json({ assignment, ...(audited === undefined ? {} : { audited }) });
}
