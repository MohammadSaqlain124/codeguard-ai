import { componentLogger } from "../config/logger.js";
import { BaselineProfileModel } from "../models/BaselineProfile.js";
import { LANGUAGES } from "../models/index.js";
import type { SubmissionDoc } from "../models/Submission.js";
import { getSubmission } from "../storage/minio.js";
import { extractFeatures } from "./detectorClient.js";

const log = componentLogger("behavioural");

type Language = (typeof LANGUAGES)[number];

// The four features that measured an F ratio above 1 on real multi-author
// code, meaning they vary less within one author than between authors. The
// other six measured 0.14 to 0.56, and including them made author
// identification worse: 87.9% with these four, 78.8% with all ten. All ten
// stay stored on the baseline, so this choice is reversible.
export const SCORED_FEATURES = [
  "blank_line_ratio",
  "avg_line_length",
  "max_block_depth",
  "comment_density",
] as const;

type Scored = (typeof SCORED_FEATURES)[number];

// Where the score reaches 1. Three standard deviations of the typical
// student-to-student spread: measured on real code, honest work had a median
// RMS z of 0.70 and a 90th percentile of 1.83, foreign work a median of 2.20.
export const Z_SATURATION = 3;

// A cohort can produce a spread of zero on a coarse feature, and dividing by
// it gives infinity. Each floor is a tenth of the median within-author
// spread measured on real code.
export const VARIANCE_FLOOR: Record<Scored, number> = {
  blank_line_ratio: 0.0065,
  avg_line_length: 0.4947,
  max_block_depth: 0.2236,
  comment_density: 0.001,
};

// Anchors far from the submission's size measure size rather than style.
// Restricting real files to one size band raised author identification from
// 32% to 79%, the largest single effect measured.
export const SIZE_BAND_LOW = 0.5;
export const SIZE_BAND_HIGH = 2;
export const MIN_BAND_ANCHORS = 2;

// Fewer ready baselines than this and there is no cohort spread to divide by.
export const MIN_COHORT_BASELINES = 3;

// Only what this file reads, so both a hydrated DetectionConfig and the
// DEFAULT_DETECTION_CONFIG object satisfy it without a union type.
export type LayerConfig = {
  w2: number;
  minBaselineConfidence: number;
  lowVariancePercentile: number;
};

export type Calibration = {
  spread: Record<string, number>;
  baselines: number;
  variances: number[];
};

/**
 * The cohort's typical within-author spread, per feature.
 *
 * This is the denominator for every z-score, and using it rather than the
 * student's own spread is the morning's most useful finding. With four
 * anchors a student's own standard deviation comes from three degrees of
 * freedom and is so unstable that honest work produced RMS z values above
 * 15. Pooling across the cohort measured better at every shrinkage setting
 * tried: AUC 0.909 against 0.766 for the student's own spread.
 *
 * The student's mean is what is personal. The spread turns out to be more a
 * property of the feature than of the person, so it is borrowed from the
 * cohort and the student's own spread becomes mitigation 4's signal instead.
 */
export async function cohortCalibration(
  courseId: string,
  language: Language,
): Promise<Calibration> {
  const rows = await BaselineProfileModel.find({
    language,
    status: "ready",
    // a baseline belongs to a student, not a course, so the cohort is
    // whoever has an anchor from this course
    "anchors.course": courseId,
  }).select("features intraStudentVariance");

  const spread: Record<string, number> = {};
  for (const feature of SCORED_FEATURES) {
    let weighted = 0;
    let degrees = 0;
    for (const row of rows) {
      const stat = row.features.find((f) => f.feature === feature);
      if (!stat || stat.samples < 2) continue;
      // pooled variance: each student contributes samples-1 degrees of freedom
      weighted += (stat.samples - 1) * stat.stdDev * stat.stdDev;
      degrees += stat.samples - 1;
    }
    spread[feature] = degrees > 0 ? Math.sqrt(weighted / degrees) : 0;
  }

  const variances = rows
    .map((row) => row.intraStudentVariance)
    .filter((value): value is number => typeof value === "number");

  return { spread, baselines: rows.length, variances };
}

/** Where this student's own consistency sits in the cohort, as a percentage. */
function percentileOf(value: number, population: number[]): number | undefined {
  if (population.length === 0) return undefined;
  const below = population.filter((other) => other < value).length;
  return (100 * below) / population.length;
}

/**
 * Score one submission against its author's baseline.
 *
 * Never throws for a missing or unusable baseline: it returns a skipped
 * layer with a reason, because "we could not check" and "we checked and
 * found nothing" must not look the same on a student's record.
 */
export async function scoreBehavioural(
  submission: SubmissionDoc,
  courseId: string,
  config: LayerConfig,
) {
  const startedAt = Date.now();
  const language = submission.language as Language;

  const skip = (reason: string) => ({
    status: "skipped" as const,
    reason,
    durationMs: Date.now() - startedAt,
    effectiveW2: 0,
  });

  const baseline = await BaselineProfileModel.findOne({
    student: submission.student,
    language,
  });
  if (!baseline) return skip("No style baseline for this student yet");
  if (baseline.status !== "ready") {
    return skip(`Baseline is ${baseline.status}: ${baseline.reason || "no reason recorded"}`);
  }

  const calibration = await cohortCalibration(courseId, language);
  if (calibration.baselines < MIN_COHORT_BASELINES) {
    return skip(
      `Only ${calibration.baselines} baselines in this cohort, ${MIN_COHORT_BASELINES} needed to calibrate`,
    );
  }

  const source = (await getSubmission(submission.objectKey)).toString("utf8");
  const measured = await extractFeatures({
    submissionId: submission.id,
    language,
    source,
  });

  if (!measured.parsed) {
    return {
      status: "failed" as const,
      reason: measured.parseError ?? "Could not parse the submission",
      durationMs: Date.now() - startedAt,
      effectiveW2: 0,
    };
  }

  // Numbers from one definition of the features are never compared with
  // another's. The baseline is rebuilt instead, which File 076 triggers.
  if (measured.featureSetVersion !== baseline.featureSetVersion) {
    return skip(
      `Baseline was built on feature set ${baseline.featureSetVersion}, the detector reports ${measured.featureSetVersion}`,
    );
  }

  // Comparing a 40 line submission against a 600 line baseline measures
  // size, not style, so prefer anchors of a comparable size.
  const low = submission.lineCount * SIZE_BAND_LOW;
  const high = submission.lineCount * SIZE_BAND_HIGH;
  const inBand = baseline.anchors.filter(
    (anchor) => anchor.lineCount >= low && anchor.lineCount <= high,
  );
  const sizeMatched = inBand.length >= MIN_BAND_ANCHORS;
  const used = sizeMatched ? inBand : baseline.anchors;

  const deviations = [];
  const zScores: number[] = [];

  for (const feature of SCORED_FEATURES) {
    const value = measured.features[feature];
    if (typeof value !== "number") continue;

    // the mean comes from this student's anchors, trust-weighted
    const samples = used
      .map((anchor) => ({
        value: anchor.values.find((entry) => entry.feature === feature)?.value,
        weight: anchor.trust,
      }))
      .filter((s): s is { value: number; weight: number } => typeof s.value === "number");
    if (samples.length < MIN_BAND_ANCHORS) continue;

    const weightSum = samples.reduce((total, s) => total + s.weight, 0);
    const mean = samples.reduce((total, s) => total + s.weight * s.value, 0) / weightSum;

    // the spread comes from the cohort, floored so it can never be zero
    const stdDev = Math.max(calibration.spread[feature] ?? 0, VARIANCE_FLOOR[feature]);
    const zScore = (value - mean) / stdDev;

    zScores.push(zScore);
    deviations.push({ feature, value, baselineMean: mean, baselineStdDev: stdDev, zScore });
  }

  if (zScores.length === 0) {
    return skip("No scored feature could be compared against this baseline");
  }

  // Root mean square across the features, which is the distance in z-space
  // that the author-identification measurement was based on, then saturated
  // so the score stays inside 0 to 1 without clamping hiding anything.
  const rms = Math.sqrt(zScores.reduce((total, z) => total + z * z, 0) / zScores.length);
  const score = Math.min(1, rms / Z_SATURATION);

  // The schema's comment is "below this baseline confidence, w2 is
  // attenuated toward zero", so that is what this implements. For the
  // continuous alternative, which always attenuates a little, the line is
  //   const effectiveW2 = config.w2 * baseline.confidence;
  const effectiveW2 =
    baseline.confidence >= config.minBaselineConfidence
      ? config.w2
      : config.w2 * (baseline.confidence / config.minBaselineConfidence);

  // Mitigation 4. A student whose own work barely varies produces a large
  // deviation for almost any change, so it is reported beside the score and
  // never folded into it.
  const percentile = percentileOf(
    baseline.intraStudentVariance ?? 0,
    calibration.variances,
  );
  const lowVariance = {
    flagged: percentile !== undefined && percentile < config.lowVariancePercentile,
    intraStudentVariance: baseline.intraStudentVariance,
    cohortPercentile: percentile,
  };

  const reason = sizeMatched
    ? undefined
    : `Fewer than ${MIN_BAND_ANCHORS} anchors within ${SIZE_BAND_LOW}x to ${SIZE_BAND_HIGH}x of ${submission.lineCount} lines, so all ${baseline.anchors.length} were used`;

  log.info(
    {
      submissionId: submission.id,
      score: Number(score.toFixed(4)),
      rms: Number(rms.toFixed(4)),
      features: deviations.length,
      anchors: used.length,
      sizeMatched,
      confidence: baseline.confidence,
      effectiveW2: Number(effectiveW2.toFixed(4)),
      cohortBaselines: calibration.baselines,
      lowVariance: lowVariance.flagged,
    },
    "behavioural layer scored",
  );

  return {
    status: "ok" as const,
    reason,
    durationMs: Date.now() - startedAt,
    score,
    baselineConfidence: baseline.confidence,
    anchorCount: used.length,
    features: deviations,
    lowVariance,
    effectiveW2,
  };
}
