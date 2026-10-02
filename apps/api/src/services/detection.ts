import { componentLogger } from "../config/logger.js";
import { AssignmentModel, SubmissionModel } from "../models/index.js";
import { DEFAULT_DETECTION_CONFIG, DetectionConfigModel } from "../models/DetectionConfig.js";
import { DetectionResultModel } from "../models/DetectionResult.js";
import type { SubmissionDoc } from "../models/Submission.js";
import { getSubmission } from "../storage/minio.js";
import { enqueueRecalibration } from "../queue/detectionQueue.js";
import { analyzeSubmission, type CandidateSource } from "./detectorClient.js";
import { scoreBehavioural } from "./behavioural.js";

const log = componentLogger("detection");

// The detector refuses more than this, and sending more would mean
// fetching files we know will be ignored.
const MAX_CANDIDATES = 50;

type Candidate = {
  submissionId: string;
  studentId: string;
  contentHash: string;
  objectKey: string;
};

/**
 * The latest attempt of every other student on this assignment, capped.
 * Earlier attempts by the same student are left out: they would crowd the
 * list with near copies of work we already have.
 */
async function findCandidates(submission: SubmissionDoc): Promise<Candidate[]> {
  const rows = await SubmissionModel.find({
    assignment: submission.assignment,
    student: { $ne: submission.student },
  })
    .sort({ student: 1, attempt: -1 })
    .select("student attempt contentHash objectKey submittedAt");

  const latestPerStudent = new Map<string, Candidate>();
  for (const row of rows) {
    const studentId = String(row.student);
    // sorted attempt-descending, so the first one seen is the latest
    if (!latestPerStudent.has(studentId)) {
      latestPerStudent.set(studentId, {
        submissionId: String(row._id),
        studentId,
        contentHash: row.contentHash,
        objectKey: row.objectKey,
      });
    }
  }

  return [...latestPerStudent.values()].slice(0, MAX_CANDIDATES);
}

async function loadSources(candidates: Candidate[]): Promise<CandidateSource[]> {
  const loaded = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const bytes = await getSubmission(candidate.objectKey);
        return { submissionId: candidate.submissionId, source: bytes.toString("utf8") };
      } catch (err) {
        // one missing file must not stop the analysis of everyone else
        log.warn({ err, submissionId: candidate.submissionId }, "candidate file could not be read");
        return null;
      }
    }),
  );
  return loaded.filter((entry): entry is CandidateSource => entry !== null);
}

export async function runDetection(submission: SubmissionDoc) {
  // The moment the world was read, which is what this result reflects.
  // Not the moment the row is written: candidates are gathered first, and
  // a submission arriving during the detector call would otherwise make
  // this result look newer than the cohort it never saw, so the
  // recalibration job would never notice it was analysed too early.
  const computedAt = new Date();

  const assignment = await AssignmentModel.findById(submission.assignment);
  if (!assignment) throw new Error("Assignment no longer exists");

  const config =
    (await DetectionConfigModel.findOne({ course: assignment.course })) ?? DEFAULT_DETECTION_CONFIG;
  // a course with no config row is using the defaults, which are version 1
  const configVersion = "version" in config ? config.version : 1;

  const candidates = await findCandidates(submission);
  const byId = new Map(candidates.map((c) => [c.submissionId, c]));

  // identical bytes are found here rather than by the detector, which
  // never sees a hash and could only infer it from a similarity of 1
  const duplicate = candidates.find((c) => c.contentHash === submission.contentHash);

  const source = (await getSubmission(submission.objectKey)).toString("utf8");
  const sources = await loadSources(candidates);

  const analysis = await analyzeSubmission({
    submissionId: submission.id,
    language: submission.language,
    source,
    candidates: sources,
  });

  const matches = analysis.matches.map((match) => ({
    otherSubmission: match.submissionId,
    otherStudent: byId.get(match.submissionId)?.studentId,
    similarity: match.similarity,
    // Meaningless until the recalibration job computes it against the real
    // cohort. Written as zero with its sample size so nobody mistakes it
    // for a finding, rather than left absent, which the schema forbids.
    cohortZScore: 0,
    spans: match.spans,
  }));

  const best = matches.length > 0 ? Math.max(...matches.map((m) => m.similarity)) : 0;

  const structural = !analysis.parsed
    ? { status: "failed" as const, reason: analysis.parseError ?? "Could not parse the submission" }
    : !analysis.compared
      ? { status: "skipped" as const, reason: "No other submissions to compare against yet" }
      : { status: "ok" as const, score: best };

  // ---- Layer 2 ----
  let behavioural;
  try {
    behavioural = await scoreBehavioural(submission, String(assignment.course), config);
  } catch (err) {
    // A Layer 2 outage must not throw away a good Layer 1 finding. If this
    // threw, the job would retry, re-run everything, fail at the same point
    // again, and the submission would end at "failed" with a structural
    // result nobody ever sees.
    log.warn({ err, submissionId: submission.id }, "behavioural layer failed");
    behavioural = {
      status: "failed" as const,
      // the schema's limit, so recording the failure cannot itself fail
      reason: (err as Error).message.slice(0, 300),
      durationMs: 0,
      effectiveW2: 0,
    };
  }

  const structuralOk = structural.status === "ok";
  const behaviouralOk = behavioural.status === "ok";
  // narrowed on the discriminant, not on whether a property happens to
  // exist, which does not narrow a union reliably
  const behaviouralScore = behavioural.status === "ok" ? behavioural.score : 0;
  const effectiveW2 = behavioural.effectiveW2;

  // RPS is renormalised over the layers that actually ran. Treating an
  // absent layer as a score of zero would cap a verbatim copy at w1, which
  // is 0.4 by default and below the 0.5 review threshold: the system would
  // find a perfect copy and then decline to flag it. With Layer 2 present
  // the same rule now lets Layer 2 drive the score on its own, which is the
  // case Layer 2 exists for — outsourced work with no classmate to match.
  const activeWeight = (structuralOk ? config.w1 : 0) + (behaviouralOk ? effectiveW2 : 0);
  const rps =
    activeWeight > 0
      ? (config.w1 * (structuralOk ? best : 0) + effectiveW2 * behaviouralScore) / activeWeight
      : 0;

  // Two layers that both ran and landed on opposite sides of the review
  // threshold are not a middling case, they are two confident and opposite
  // findings. The average hides that, so it is recorded beside the average
  // instead of being allowed to cancel out.
  const signalDisagreement =
    structuralOk &&
    behaviouralOk &&
    best >= config.reviewThreshold !== (behaviouralScore >= config.reviewThreshold);

  const behaviouralBranch =
    behavioural.status === "ok"
      ? {
          status: behavioural.status,
          reason: behavioural.reason,
          durationMs: behavioural.durationMs,
          score: behavioural.score,
          baselineConfidence: behavioural.baselineConfidence,
          anchorCount: behavioural.anchorCount,
          features: behavioural.features,
          lowVariance: behavioural.lowVariance,
        }
      : {
          status: behavioural.status,
          reason: behavioural.reason,
          durationMs: behavioural.durationMs,
        };

  // one current result per submission, and re-running makes a new revision
  const previous = await DetectionResultModel.findOne({
    submission: submission._id,
    isCurrent: true,
  });
  if (previous) {
    previous.isCurrent = false;
    await previous.save();
  }

  const result = await DetectionResultModel.create({
    submission: submission._id,
    revision: previous ? previous.revision + 1 : 1,
    isCurrent: true,

    assignment: assignment._id,
    course: assignment.course,
    student: submission.student,
    language: submission.language,

    structural: {
      ...structural,
      durationMs: analysis.durationMs,
      exactDuplicateOf: duplicate ? duplicate.submissionId : undefined,
      candidatesConsidered: analysis.candidatesCompared,
      cohortSampleSize: matches.length,
      cohortComputedAt: computedAt,
      matches,
    },
    behavioral: behaviouralBranch,
    aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" },

    rps,
    weights: { w1: config.w1, w2: config.w2, w3: config.w3, effectiveW2 },
    configVersion,
    detectorVersion: analysis.detectorVersion,
    signalDisagreement,
    computedAt,
    // the sum of what each layer reported. The structural figure is the
    // detector's own time; the behavioural figure includes its storage read
    // and round trip, so these are not quite the same measurement.
    totalDurationMs: analysis.durationMs + behavioural.durationMs,
  });

  log.info(
    {
      submissionId: submission.id,
      rps: Number(rps.toFixed(4)),
      structural: structural.status,
      structuralScore: structuralOk ? Number(best.toFixed(4)) : undefined,
      behavioural: behavioural.status,
      behaviouralScore: behaviouralOk ? Number(behaviouralScore.toFixed(4)) : undefined,
      behaviouralReason: behavioural.reason,
      effectiveW2,
      disagreement: signalDisagreement,
      candidates: candidates.length,
      compared: analysis.candidatesCompared,
      matches: matches.length,
      duplicateOf: duplicate?.submissionId,
    },
    "detection complete",
  );

  // the cohort just grew by one, so everyone's statistics are now behind
  await enqueueRecalibration(String(assignment._id));

  // a plain summary, so the caller never has to read nested paths back
  // off a hydrated document and guess whether they are there
  return {
    resultId: result.id as string,
    rps,
    structuralStatus: structural.status,
    behaviouralStatus: behavioural.status,
    behaviouralScore: behaviouralOk ? behaviouralScore : undefined,
    signalDisagreement,
    matchCount: matches.length,
    duplicateOf: duplicate?.submissionId,
  };
}
