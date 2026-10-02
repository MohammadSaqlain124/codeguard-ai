import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { Types } from "mongoose";

import { componentLogger } from "../config/logger.js";
import { SubmissionModel } from "../models/index.js";
import { enqueueBaselineRebuild, enqueueDetection } from "../queue/detectionQueue.js";
import {
  loadAssignmentFor,
  loadSubmissionFor,
  loadSubmissionForManage,
} from "../services/access.js";
import { eligibilityFor } from "../services/anchors.js";
import { recordAudit } from "../services/audit.js";
import {
  getSubmission as readStoredFile,
  putSubmission,
  removeSubmission,
  submissionKey,
} from "../storage/minio.js";
import { AppError } from "../utils/AppError.js";
import { skipFor } from "../validation/common.js";
import type { ListSubmissionsQuery, NominateBody } from "../validation/submissionSchemas.js";

const log = componentLogger("submission");

function isDuplicateKey(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

export async function createSubmission(req: Request, res: Response) {
  const { assignment, course } = await loadAssignmentFor(req, "view");
  const user = req.user!;
  const upload = req.upload!;

  // the route allows students only; this keeps the handler safe on its own
  if (user.role !== "student") throw AppError.forbidden("Only students submit work");
  if (course.isArchived) throw AppError.conflict("This course is archived");

  const expected = assignment.language === "java" ? ".java" : ".py";
  if (upload.extension !== expected) {
    throw AppError.unsupportedMediaType(`This assignment expects a ${expected} file`);
  }

  // the server's clock, at the moment the upload finished, decides lateness
  const now = new Date();
  const isLate = now > assignment.dueAt;
  if (isLate && !assignment.acceptsLate) throw AppError.conflict("The deadline has passed");

  // every accepted upload counts, even one the detector later can't parse
  const used = await SubmissionModel.countDocuments({ assignment: assignment._id, student: user.id });
  if (used >= assignment.maxSubmissions) {
    throw AppError.conflict(`All ${assignment.maxSubmissions} attempts have been used`);
  }

  // identical content is stored, never refused or announced: it's evidence for faculty
  const contentHash = createHash("sha256").update(upload.content).digest("hex");
  const objectKey = submissionKey(assignment.id, user.id);

  await putSubmission(objectKey, upload.content);

  let submission;
  try {
    submission = await SubmissionModel.create({
      assignment: assignment._id,
      student: user.id,
      attempt: used + 1,
      provenance: assignment.provenance,
      language: assignment.language,
      originalFilename: upload.originalName,
      objectKey,
      sizeBytes: upload.sizeBytes,
      contentHash,
      lineCount: upload.lineCount,
      submittedAt: now,
      isLate,
    });
  } catch (err) {
    // the file is stored but its record isn't, so remove the file
    await removeSubmission(objectKey);
    // two uploads at once both computed the same attempt number; the index stopped one
    if (isDuplicateKey(err)) {
      throw AppError.conflict("Another upload for this assignment is in progress. Try again.");
    }
    throw err;
  }

  // the status only claims "queued" once the job is really on the queue
  if (await enqueueDetection(submission.id, "upload")) {
    submission.status = "queued";
    await submission.save();
  }

  log.info(
    { submissionId: submission.id, assignmentId: assignment.id, attempt: submission.attempt, isLate, status: submission.status, by: user.id },
    "submission stored",
  );
  res.status(201).json({ submission });
}

export async function listSubmissions(req: Request, res: Response) {
  const { assignment } = await loadAssignmentFor(req, "view");
  const user = req.user!;
  const { page, limit, status, student, late } = req.query as unknown as ListSubmissionsQuery;

  // a student sees only their own attempts, whatever they ask for
  const filter = {
    assignment: assignment._id,
    ...(user.role === "student" ? { student: user.id } : student ? { student } : {}),
    ...(status ? { status } : {}),
    ...(late !== undefined ? { isLate: late } : {}),
  };

  const [items, total] = await Promise.all([
    SubmissionModel.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate("student", "name rollNo"),
    SubmissionModel.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total });
}

export async function getSubmissionDetails(req: Request, res: Response) {
  const submission = await loadSubmissionFor(req);
  res.json({ submission });
}

export async function downloadSubmission(req: Request, res: Response) {
  const submission = await loadSubmissionFor(req);
  const content = await readStoredFile(submission.objectKey);

  log.info({ submissionId: submission.id, by: req.user!.id }, "submission file downloaded");

  // attachment() writes a Content-Disposition that handles non-English names;
  // octet-stream makes browsers download rather than display
  res.attachment(submission.originalFilename).type("application/octet-stream").send(content);
}

/**
 * Marks a submission as a Layer 2 anchor. For students with no invigilated
 * work, this is the only way their baseline ever gets built.
 */
export async function nominateSubmission(req: Request, res: Response) {
  const { submission, course } = await loadSubmissionForManage(req);
  const user = req.user!;
  const { reason } = req.body as NominateBody;

  // checked before eligibilityFor, because it needs no extra queries
  if (submission.baselineEligible) {
    throw AppError.conflict("This submission has already been nominated");
  }

  const check = await eligibilityFor(submission.id);
  if (!check.eligible) throw AppError.conflict(check.reason);

  submission.baselineEligible = true;
  submission.nominatedBy = new Types.ObjectId(user.id);
  submission.nominatedAt = new Date();
  await submission.save();

  // Both of these follow the save, so neither can report something that
  // did not happen. Both report their own outcome rather than throwing.
  const audited = await recordAudit({
    actor: user.id,
    actorRole: user.role,
    action: "baseline.sample_added",
    targetType: "Submission",
    targetId: submission.id,
    course: course.id,
    changes: { before: { baselineEligible: false }, after: { baselineEligible: true } },
    reason,
  });

  const rebuildQueued = await enqueueBaselineRebuild(String(submission.student), submission.language);

  log.info(
    { submissionId: submission.id, student: String(submission.student), by: user.id, audited, rebuildQueued },
    "submission nominated as a baseline anchor",
  );

  res.json({ submission, audited, rebuildQueued });
}

/**
 * Takes a nomination back. The baseline still holds this submission's
 * measurements until it is rebuilt, which is why the rebuild is queued here
 * rather than waiting for the student's next upload.
 */
export async function withdrawNomination(req: Request, res: Response) {
  const { submission, course } = await loadSubmissionForManage(req);
  const user = req.user!;
  const { reason } = req.body as NominateBody;

  // invigilated work is an anchor without ever being nominated, so this
  // also refuses any attempt to un-anchor it here
  if (!submission.baselineEligible) {
    throw AppError.conflict("This submission is not a nominated anchor");
  }

  const previousBy = submission.nominatedBy ? String(submission.nominatedBy) : null;

  submission.baselineEligible = false;
  // set() rather than assignment, because clearing an optional path is the
  // one case where mongoose and typescript disagree
  submission.set("nominatedBy", undefined);
  submission.set("nominatedAt", undefined);
  await submission.save();

  const audited = await recordAudit({
    actor: user.id,
    actorRole: user.role,
    action: "baseline.sample_removed",
    targetType: "Submission",
    targetId: submission.id,
    course: course.id,
    changes: {
      before: { baselineEligible: true, nominatedBy: previousBy },
      after: { baselineEligible: false },
    },
    reason,
  });

  const rebuildQueued = await enqueueBaselineRebuild(String(submission.student), submission.language);

  log.info(
    { submissionId: submission.id, student: String(submission.student), by: user.id, audited, rebuildQueued },
    "nomination withdrawn",
  );

  res.json({ submission, audited, rebuildQueued });
}
