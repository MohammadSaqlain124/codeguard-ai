import { componentLogger } from "../config/logger.js";
import { AssignmentModel, SubmissionModel } from "../models/index.js";
import { DEFAULT_DETECTION_CONFIG, DetectionConfigModel } from "../models/DetectionConfig.js";
import { DetectionResultModel } from "../models/DetectionResult.js";
import type { SubmissionDoc } from "../models/Submission.js";
import { getSubmission } from "../storage/minio.js";
import { analyzeSubmission, type CandidateSource } from "./detectorClient.js";

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
 * The latest attempt of every other student on this assignment, newest
 * first, capped. Earlier attempts by the same student are left out: they
 * would crowd the list with near copies of work we already have.
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
    // Meaningless until File 067 computes it against the real cohort.
    // Written as zero with its sample size so nobody mistakes it for a
    // finding, rather than left absent, which the schema forbids.
    cohortZScore: 0,
    spans: match.spans,
  }));

  const best = matches.length > 0 ? Math.max(...matches.map((m) => m.similarity)) : 0;

  const structural = !analysis.parsed
    ? { status: "failed" as const, reason: analysis.parseError ?? "Could not parse the submission" }
    : !analysis.compared
      ? { status: "skipped" as const, reason: "No other submissions to compare against yet" }
      : { status: "ok" as const, score: best };

  // Layers 2 and 3 do not exist yet, so their weights contribute nothing
  // and RPS is renormalised over the layers that actually ran. Treating a
  // missing layer as a score of zero would cap a perfect structural match
  // at w1, which is 0.4 by default, below the 0.5 review threshold: the
  // system would find a verbatim copy and then decline to flag it.
  const effectiveW2 = 0;
  const activeWeight = structural.status === "ok" ? config.w1 : 0;
  const rps = activeWeight > 0 ? (config.w1 * best) / activeWeight : 0;

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
      cohortComputedAt: new Date(),
      matches,
    },
    behavioral: { status: "skipped", reason: "Layer 2 is not implemented yet" },
    aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" },

    rps,
    weights: { w1: config.w1, w2: config.w2, w3: config.w3, effectiveW2 },
    configVersion,
    detectorVersion: analysis.detectorVersion,
    // needs at least two layers to disagree about anything
    signalDisagreement: false,
    totalDurationMs: analysis.durationMs,
  });

  log.info(
    {
      submissionId: submission.id,
      rps: Number(rps.toFixed(4)),
      status: structural.status,
      candidates: candidates.length,
      compared: analysis.candidatesCompared,
      matches: matches.length,
      duplicateOf: duplicate?.submissionId,
      detectorMs: analysis.durationMs,
    },
    "detection complete",
  );

  // a plain summary, so the caller never has to read nested paths back
  // off a hydrated document and guess whether they are there
  return {
    resultId: result.id as string,
    rps,
    structuralStatus: structural.status,
    matchCount: matches.length,
    duplicateOf: duplicate?.submissionId,
  };
}
