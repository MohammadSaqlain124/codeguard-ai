import { componentLogger } from "../config/logger.js";
import { AssignmentModel, LANGUAGES, PROVENANCE, SubmissionModel } from "../models/index.js";
import { DEFAULT_DETECTION_CONFIG, DetectionConfigModel } from "../models/DetectionConfig.js";
import { DetectionResultModel } from "../models/DetectionResult.js";
import { MAX_ANCHORS } from "../models/BaselineProfile.js";

const log = componentLogger("anchors");

type Provenance = (typeof PROVENANCE)[number];
type Language = (typeof LANGUAGES)[number];

// How far each kind of anchor is believed. Invigilated work was watched
// being written. Nominated work is somebody's judgement, and a judgement
// can be wrong, which is why trust is a number here rather than a yes or no.
//
// `satisfies` makes this a compile error if PROVENANCE ever gains a value
// with no trust, instead of a crash the first time one turns up.
export const ANCHOR_TRUST = {
  invigilated: 1,
  takehome: 0.6,
  unknown: 0.4,
} as const satisfies Record<Provenance, number>;

// Below this, every feature is noise. A twelve line file gave us one
// function and a dozen identifiers, and a single short loop variable moved
// the mean identifier length by 0.4. A guess until File 073a measures it.
export const MIN_ANCHOR_LINES = 30;

export type Anchor = {
  submissionId: string;
  assignmentId: string;
  courseId: string;
  provenance: Provenance;
  trust: number;
  lineCount: number;
  objectKey: string;
  submittedAt: Date;
};

// Each predicate asks for exactly the fields it reads. Asking for more
// forces callers to invent values they do not have, which is how the
// first version ended up passing baselineEligible: true to a function
// that never looked at it.
type HasProvenance = { provenance: Provenance };
type AnchorFacts = HasProvenance & { baselineEligible: boolean };

/** Invigilated work is an anchor because it was supervised, not because anyone said so. */
export function isAutomaticAnchor(submission: HasProvenance): boolean {
  return submission.provenance === "invigilated";
}

export function isAnchor(submission: AnchorFacts): boolean {
  return isAutomaticAnchor(submission) || submission.baselineEligible;
}

export function trustFor(submission: HasProvenance): number {
  return ANCHOR_TRUST[submission.provenance];
}

export type Eligibility = { eligible: boolean; reason: string };

/**
 * Whether faculty may nominate this submission as an anchor.
 *
 * Deliberately does NOT require Layer 2 to have passed. A submission
 * cannot be made to pass the layer whose baseline it is being used to
 * build: the first anchor has no baseline to be checked against, and
 * neither does the second. A layer can never be part of its own
 * precondition. Layer 3 could join this check later, since AI-content
 * detection needs no baseline.
 *
 * Every path refuses rather than allows when something is missing. The
 * question is "may this become a baseline?", and "I cannot tell" is not
 * a yes.
 */
export async function eligibilityFor(submissionId: string): Promise<Eligibility> {
  const submission = await SubmissionModel.findById(submissionId);
  if (!submission) {
    return { eligible: false, reason: "That submission does not exist" };
  }

  if (isAutomaticAnchor(submission)) {
    return { eligible: false, reason: "Invigilated work is already an anchor and needs no nomination" };
  }

  if (submission.status !== "analyzed") {
    return { eligible: false, reason: `Not analysed yet, the status is ${submission.status}` };
  }

  // checked before the detection result, because it needs no second query
  if (submission.lineCount < MIN_ANCHOR_LINES) {
    return {
      eligible: false,
      reason: `Too short to measure reliably, ${submission.lineCount} lines against a minimum of ${MIN_ANCHOR_LINES}`,
    };
  }

  const result = await DetectionResultModel.findOne({
    submission: submission._id,
    isCurrent: true,
  });
  if (!result) {
    return { eligible: false, reason: "There is no detection result to judge it by" };
  }

  // The schema types this whole branch as optional, because it is a nested
  // object rather than a subdocument schema. Narrowed once here so the
  // reads below are safe, and a missing branch refuses the nomination.
  const structural = result.structural;

  // "skipped" means the cohort was empty when it ran, and "failed" means it
  // would not parse. Both are self-healing: recalibration re-analyses the
  // first, and the second needs a new upload.
  if (!structural || structural.status !== "ok") {
    return {
      eligible: false,
      reason: `Layer 1 produced no finding to trust, its status is ${structural?.status ?? "missing"}`,
    };
  }

  // the threshold below would catch this anyway, since identical bytes
  // score 1.0, but saying it plainly is worth one line
  if (structural.exactDuplicateOf) {
    return { eligible: false, reason: "Its bytes are identical to another submission" };
  }

  const assignment = await AssignmentModel.findById(submission.assignment);
  if (!assignment) {
    return { eligible: false, reason: "Its assignment no longer exists" };
  }

  const config =
    (await DetectionConfigModel.findOne({ course: assignment.course })) ?? DEFAULT_DETECTION_CONFIG;

  if (result.rps >= config.reviewThreshold) {
    return {
      eligible: false,
      reason: `Layer 1 flagged it, rps ${result.rps.toFixed(4)} against a threshold of ${config.reviewThreshold}`,
    };
  }

  return {
    eligible: true,
    reason: "Layer 1 ran, found nothing above the threshold, and the file is long enough to measure",
  };
}

/**
 * This student's anchors for one language, strongest evidence first.
 *
 * Uses the index Phase 2 left for exactly this query:
 * { student, provenance, language }.
 */
export async function findAnchors(studentId: string, language: Language): Promise<Anchor[]> {
  const rows = await SubmissionModel.find({
    student: studentId,
    language,
    // an anchor we could not analyse is an anchor we cannot measure
    status: "analyzed",
    lineCount: { $gte: MIN_ANCHOR_LINES },
    // Invigilated work counts on its own, and faculty may nominate other
    // work by hand. To use the stricter Phase 2 rule instead, where
    // invigilated is necessary AND confirmation is additional, replace
    // this line with:
    //   provenance: "invigilated", baselineEligible: true,
    $or: [{ provenance: "invigilated" }, { baselineEligible: true }],
  }).select("assignment provenance lineCount objectKey submittedAt");

  if (rows.length === 0) return [];

  // The course lives on the assignment, and the baseline stores it against
  // every anchor so a whole course can be audited or excluded later without
  // reading the submissions back.
  const assignmentIds = [...new Set(rows.map((row) => String(row.assignment)))];
  const assignments = await AssignmentModel.find({ _id: { $in: assignmentIds } }).select("course");
  const courseOf = new Map(assignments.map((a) => [String(a._id), String(a.course)]));

  const anchors = rows.flatMap((row): Anchor[] => {
    const courseId = courseOf.get(String(row.assignment));
    if (!courseId) {
      // an anchor we cannot attribute to a course is not an anchor
      log.warn({ submissionId: String(row._id) }, "anchor skipped, its assignment is gone");
      return [];
    }
    return [
      {
        submissionId: String(row._id),
        assignmentId: String(row.assignment),
        courseId,
        provenance: row.provenance,
        trust: trustFor(row),
        lineCount: row.lineCount,
        objectKey: row.objectKey,
        submittedAt: row.submittedAt,
      },
    ];
  });

  // Most trusted first, then most recent, so the cap keeps the best
  // evidence rather than whatever order the index happened to return.
  anchors.sort(
    (a, b) => b.trust - a.trust || b.submittedAt.getTime() - a.submittedAt.getTime(),
  );

  // the schema refuses more than this, so the service does not offer more
  return anchors.slice(0, MAX_ANCHORS);
}

/** What File 073 needs to decide whether these anchors make a usable baseline. */
export function summarise(anchors: Anchor[]) {
  return {
    count: anchors.length,
    invigilated: anchors.filter(isAutomaticAnchor).length,
    trustTotal: anchors.reduce((total, anchor) => total + anchor.trust, 0),
  };
}

/**
 * Whether this student has at least one observed sample in this language.
 *
 * A fact, not a policy. The policy that Layer 2 needs an observed sample
 * lives in buildBaseline, which sets the status, and in baselineUsability,
 * which reads it. This exists because the nomination endpoint has to answer
 * the question BEFORE the rebuild has run, when there is no baseline to ask.
 *
 * Nomination cannot create an observed sample. That is the whole point of
 * the distinction: invigilated work was watched being written, nominated
 * work is believed.
 */
export async function hasObservedAnchor(studentId: string, language: Language): Promise<boolean> {
  const observed = await SubmissionModel.countDocuments({
    student: studentId,
    language,
    provenance: "invigilated",
    status: "analyzed",
    lineCount: { $gte: MIN_ANCHOR_LINES },
  });
  return observed > 0;
}
