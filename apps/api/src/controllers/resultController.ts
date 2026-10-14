import type { Request, Response } from "express";
import { Types } from "mongoose";

import { componentLogger } from "../config/logger.js";
import { DetectionResultModel } from "../models/DetectionResult.js";
import { loadAssignmentFor, loadSubmissionFor, loadSubmissionForManage } from "../services/access.js";
import { recordAudit } from "../services/audit.js";
import { AppError } from "../utils/AppError.js";
import { skipFor } from "../validation/common.js";
import type {
  ExplanationBody,
  ListResultsQuery,
  ResultRevisionQuery,
  ReviewBody,
} from "../validation/resultSchemas.js";

const log = componentLogger("result");

/**
 * The review queue: this assignment's current results, highest RPS first.
 *
 * Both endpoints in this file are staff-only, and a student gets the same 404
 * as a stranger rather than a 403, which is the stance the rest of the access
 * layer takes so that ids cannot be probed.
 *
 * That is a decision rather than an oversight. A student who can read their
 * own per-feature z-scores can tune a submission against them, which makes
 * Layer 2 gameable by exactly the people it exists to measure. The schema's
 * `review.studentExplanation` field means a student is meant to be able to
 * respond to a flag, but responding needs the status and the reviewer's note,
 * not the feature deviations, so that is a separate narrower endpoint and is
 * not this one.
 *
 * The projection drops the two bulky arrays. A queue row needs the score, the
 * flags and who matched whom; the line spans and the per-feature deviations
 * are what the detail endpoint is for. This is also what keeps the query
 * served by the { assignment, isCurrent, rps } index cheap.
 */
export async function listResults(req: Request, res: Response) {
  const { assignment } = await loadAssignmentFor(req, "manage");
  const { page, limit, reviewStatus, minRps } = req.query as unknown as ListResultsQuery;

  const filter = {
    assignment: assignment._id,
    isCurrent: true,
    ...(reviewStatus ? { "review.status": reviewStatus } : {}),
    ...(minRps !== undefined ? { rps: { $gte: minRps } } : {}),
  };

  const [items, total] = await Promise.all([
    DetectionResultModel.find(filter)
      .sort({ rps: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate("student", "name rollNo")
      .select("-structural.matches.spans -behavioral.features"),
    DetectionResultModel.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total });
}

/**
 * Everything behind one submission's score.
 *
 * This is the endpoint that makes the system an evidence system rather than a
 * verdict machine: it returns the weights that produced the RPS, the
 * configuration version they came from, the structural matches with their line
 * spans and who they matched, the per-feature deviations with the baseline
 * mean and spread each was measured against, the flags that say when a layer
 * is not to be trusted, and, once a decision exists, who recorded it. A
 * reviewer can disagree with the number and see why it was what it was.
 *
 * `revisions` is returned alongside because results are versioned rather than
 * overwritten. Without it a reader has no way to know an earlier revision
 * exists, and the versioning would be invisible from the outside.
 */
export async function getResult(req: Request, res: Response) {
  const { submission } = await loadSubmissionForManage(req);
  const { revision } = req.query as unknown as ResultRevisionQuery;

  const result = await DetectionResultModel.findOne({
    submission: submission._id,
    ...(revision === undefined ? { isCurrent: true } : { revision }),
  })
    .populate("student", "name rollNo")
    .populate("structural.matches.otherStudent", "name rollNo")
    // the reviewer as a person rather than an id, because a screen showing a
    // decision has to say who made it
    .populate("review.reviewedBy", "name email");

  if (!result) {
    throw AppError.notFound(
      revision === undefined ? "Detection result" : `Revision ${revision} of this result`,
    );
  }

  // distinct is untyped, so the cast is deliberate rather than lazy
  const revisions = (await DetectionResultModel.distinct("revision", {
    submission: submission._id,
  })) as number[];
  revisions.sort((a, b) => a - b);

  log.info(
    { submissionId: submission.id, revision: result.revision, by: req.user!.id },
    "detection result read",
  );

  res.json({ result, revisions });
}

/**
 * Records a human's decision about one result.
 *
 * This is the other half of the claim the project makes. Layers 1 and 2 rank
 * and stop; this is where a person takes responsibility for what happens
 * next, and where that is written down so a disciplinary committee can later
 * ask who decided what and why.
 *
 * Three rules, none of them invented here:
 *
 * The reachable states are the four in REVIEW_DECISIONS, because those are
 * the four the audit vocabulary has actions for. Reopening to "pending" is
 * refused by the schema rather than by this function.
 *
 * Any of the four may follow any other. A disciplinary process genuinely goes
 * contested then escalated, or revisits a dismissal, and constraining that
 * would be the system making a judgement about process, which is the thing it
 * is built not to do. Only a no-op is refused, because an audit entry saying
 * nothing changed is noise in the one record that must stay readable.
 *
 * The fields are set by path rather than by replacing `review` wholesale, so
 * that a student's `studentExplanation` is not destroyed by a reviewer acting
 * on the flag it answers.
 */
export async function reviewResult(req: Request, res: Response) {
  const { submission, course } = await loadSubmissionForManage(req);
  const user = req.user!;
  const { status, note } = req.body as ReviewBody;

  const result = await DetectionResultModel.findOne({
    submission: submission._id,
    isCurrent: true,
  });
  if (!result) throw AppError.notFound("Detection result");

  const before = result.review?.status ?? "pending";
  if (before === status) throw AppError.conflict(`This result is already ${status}`);

  result.set("review.status", status);
  result.set("review.reviewedBy", new Types.ObjectId(user.id));
  result.set("review.reviewedAt", new Date());
  result.set("review.note", note);
  await result.save();

  // After the save, so it cannot report something that did not happen, and
  // reporting its own outcome rather than throwing: see recordAudit's comment
  // on why a failed audit must not undo a decision that already landed.
  const audited = await recordAudit({
    actor: user.id,
    actorRole: user.role,
    action: `result.${status}`,
    targetType: "DetectionResult",
    targetId: result.id,
    course: course.id,
    changes: { before: { status: before }, after: { status } },
    reason: note,
  });

  // After the audit, not before it, for the same reason the audit comes after
  // the save: this is one more query that can fail, and a failure here must
  // not cost the record of a decision that has already landed.
  await result.populate("review.reviewedBy", "name email");

  log.info(
    {
      submissionId: submission.id,
      resultId: result.id,
      from: before,
      to: status,
      by: user.id,
      audited,
    },
    "review recorded",
  );

  res.json({ result, audited });
}

/**
 * What a student may see about their own result.
 *
 * `getResult` above returns the evidence, and a student must never reach it:
 * a student who can read their own per-feature z-scores can tune a submission
 * against them, which makes Layer 2 gameable by exactly the people it exists
 * to measure. This endpoint exists because the schema's
 * `review.studentExplanation` field promises a student can answer a decision
 * taken about them, and answering needs the decision and the reviewer's note,
 * not the deviations.
 *
 * Two rules, both deliberate.
 *
 * The projection is a whitelist and the response is assembled field by field.
 * Naming what to keep rather than what to drop means a field added to the
 * schema next month is excluded by default. A blacklist leaks it the day
 * somebody adds it, and nothing would fail to warn us.
 *
 * Nothing at all is disclosed while the review is pending. A result sitting
 * in the queue is a ranking, not an accusation, and the whole claim of this
 * project is that a person decides. Telling a student "you are being looked
 * at" before anyone has looked would make the ranking itself the verdict. An
 * un-analysed submission and a pending one are therefore indistinguishable
 * from here, which is the point rather than an oversight.
 */
export async function getMyResult(req: Request, res: Response) {
  const submission = await loadSubmissionFor(req);

  const result = await DetectionResultModel.findOne({
    submission: submission._id,
    isCurrent: true,
  }).select(
    "review.status review.note review.reviewedAt review.studentExplanation review.explainedAt",
  );

  const status = result?.review?.status;
  const decided = status !== undefined && status !== "pending";

  // the submission's own status is the student's, and says only whether their
  // upload was processed
  const self = { id: submission.id as string, status: submission.status };

  if (!decided || !result?.review) {
    res.json({ submission: self, review: null });
    return;
  }

  res.json({
    submission: self,
    review: {
      status: result.review.status,
      note: result.review.note,
      reviewedAt: result.review.reviewedAt,
      studentExplanation: result.review.studentExplanation,
      explainedAt: result.review.explainedAt,
    },
  });
}

/**
 * A student's answer to a decision recorded about them.
 *
 * Only the student themself, never staff. `loadSubmissionFor` lets a faculty
 * member reach a submission they manage, which is right for reading and wrong
 * for writing: words attributed to a student must be the student's.
 *
 * Refused while the review is pending, for the reason above. There is nothing
 * to answer yet, and saying so reveals nothing a student does not already
 * know about their own upload.
 *
 * The fields are set by path rather than by replacing `review`, which is the
 * same care `reviewResult` takes in the other direction: a student answering
 * a flag must not wipe the status and note they are answering.
 */
export async function explainResult(req: Request, res: Response) {
  const submission = await loadSubmissionFor(req);
  const user = req.user!;
  const { explanation } = req.body as ExplanationBody;

  if (!submission.student.equals(user.id)) {
    // staff reach this submission through loadSubmissionFor, and must not
    // write in the student's name. Same 404 as a stranger.
    throw AppError.notFound("Submission");
  }

  const result = await DetectionResultModel.findOne({
    submission: submission._id,
    isCurrent: true,
  });
  if (!result) throw AppError.notFound("Detection result");

  const status = result.review?.status ?? "pending";
  if (status === "pending") {
    throw AppError.conflict("No decision has been recorded yet, so there is nothing to answer");
  }

  const replacing = Boolean(result.review?.studentExplanation);
  result.set("review.studentExplanation", explanation);
  result.set("review.explainedAt", new Date());
  await result.save();

  // After the save, and reporting its own outcome rather than throwing, for
  // the reason recordAudit's comment gives. An explanation overwrites the
  // previous one, so without this entry the earlier version is unrecoverable.
  const audited = await recordAudit({
    actor: user.id,
    actorRole: user.role,
    action: "result.explained",
    targetType: "DetectionResult",
    targetId: result.id,
    course: result.course,
    changes: { before: { explained: replacing }, after: { explained: true } },
    reason: explanation,
  });

  log.info(
    { submissionId: submission.id, resultId: result.id, by: user.id, replacing, audited },
    "student explanation recorded",
  );

  res.json({
    review: {
      status: result.review?.status,
      studentExplanation: result.review?.studentExplanation,
      explainedAt: result.review?.explainedAt,
    },
    audited,
  });
}
