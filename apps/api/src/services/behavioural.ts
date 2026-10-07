import { componentLogger } from "../config/logger.js";
import { BaselineProfileModel } from "../models/BaselineProfile.js";
import { DetectionResultModel } from "../models/DetectionResult.js";
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

// Fewer scored peers in the assignment than this and the cohort's "now" is
// one or two people rather than a class. The shift is then omitted rather
// than estimated badly.
export const MIN_SHIFT_PEERS = 3;

// Mitigation 4 catches the student whose own work barely varies. These catch
// the cohort-level version of the same failure, which the Phase 5 run hit:
// when nobody in the cohort has a measurable within-author spread, every
// denominator falls back to VARIANCE_FLOOR, every z-score is divided by a
// constant invented in this file rather than measured, and every score pins
// at 1. The layer then ranks nobody. It should say so rather than return a
// confident-looking 1.0.
export const COHORT_SATURATION_SHARE = 0.8;
export const MIN_SATURATION_PEERS = 3;

// Only what this file reads, so both a hydrated DetectionConfig and the
// DEFAULT_DETECTION_CONFIG object satisfy it without a union type.
export type LayerConfig = {
  w2: number;
  minBaselineConfidence: number;
  lowVariancePercentile: number;
};

export type Calibration = {
  spread: Record<string, number>;
  // the cohort's typical value per feature during the baseline period
  mean: Record<string, number>;
  baselines: number;
  // the population mitigation 4 ranks a student against, with that student
  // removed. See cohortCalibration for why only this one excludes them.
  variances: number[];
};

// Exactly the two fields the gate reads, so a hydrated document and a lean
// row both satisfy it. Asking for more is what made File 072 pass a
// baselineEligible flag to a function that never looked at it.
type HasStatus = { status: string; reason?: string | null };

export type Usability = { usable: boolean; note?: string };

/**
 * Whether Layer 2 will score against this baseline.
 *
 * The Day 20 decision lives here: a baseline with no observed anchor stays
 * unusable, because a baseline built purely from faculty judgement encodes
 * the ghostwriter's style if that judgement was wrong, and Layer 2 would
 * then flag the student's genuine work as foreign.
 *
 * If a provisional status is ever added, with w2 attenuated rather than
 * zeroed, this function is the only thing that changes. The reason it is one
 * function rather than an inline check is that the nomination endpoint has
 * to describe the same rule to a faculty member.
 */
export function baselineUsability(baseline: HasStatus | null): Usability {
  if (!baseline) return { usable: false, note: "No style baseline for this student yet" };
  if (baseline.status !== "ready") {
    return {
      usable: false,
      note: `Baseline is ${baseline.status}: ${baseline.reason || "no reason recorded"}`,
    };
  }
  return { usable: true };
}

/**
 * The cohort's typical within-author spread and typical value, per feature.
 *
 * The spread is the denominator for every z-score, and using it rather than
 * the student's own spread is the morning's most useful finding. With four
 * anchors a student's own standard deviation comes from three degrees of
 * freedom and is so unstable that honest work produced RMS z values above
 * 15. Pooling across the cohort measured better at every shrinkage setting
 * tried: AUC 0.909 against 0.766 for the student's own spread.
 *
 * The mean is the cohort's position during the baseline period, which the
 * change point needs as its "before". Each student counts once rather than
 * once per sample: a student with eight anchors must not define the cohort's
 * typical style on their own.
 *
 * `excludeStudent` removes that student from `variances` ONLY, and never
 * from the spread or the mean. Those two pool the whole cohort on purpose,
 * and the AUC above was measured with everyone in the pool. But `variances`
 * is the population mitigation 4 ranks a student against, and ranking
 * someone against a list containing their own value pulls their percentile
 * toward the middle. A student whose work barely varies contributes that
 * very low variance to the population judging them, which is the opposite
 * of what mitigation 4 is for.
 */
export async function cohortCalibration(
  courseId: string,
  language: Language,
  excludeStudent?: string,
): Promise<Calibration> {
  const rows = await BaselineProfileModel.find({
    language,
    status: "ready",
    // a baseline belongs to a student, not a course, so the cohort is
    // whoever has an anchor from this course
    "anchors.course": courseId,
  }).select("student features intraStudentVariance");

  const spread: Record<string, number> = {};
  const mean: Record<string, number> = {};

  for (const feature of SCORED_FEATURES) {
    let weighted = 0;
    let degrees = 0;
    let total = 0;
    let students = 0;

    for (const row of rows) {
      const stat = row.features.find((f) => f.feature === feature);
      if (!stat) continue;

      // one vote per student for the mean, however many anchors they have
      total += stat.mean;
      students += 1;

      if (stat.samples < 2) continue;
      // pooled variance: each student contributes samples-1 degrees of freedom
      weighted += (stat.samples - 1) * stat.stdDev * stat.stdDev;
      degrees += stat.samples - 1;
    }

    spread[feature] = degrees > 0 ? Math.sqrt(weighted / degrees) : 0;
    mean[feature] = students > 0 ? total / students : 0;
  }

  const variances = rows
    .filter((row) => !excludeStudent || String(row.student) !== excludeStudent)
    .map((row) => row.intraStudentVariance)
    .filter((value): value is number => typeof value === "number");

  return { spread, mean, baselines: rows.length, variances };
}

export type Shift =
  | { available: false; reason: string }
  | { available: true; perFeature: Record<string, number>; peers: number };

// How much of the cohort is already pinned at the top of the scale. Left
// without a share when too few peers have been scored to tell.
export type Saturation = { peers: number; share?: number };

/**
 * Everything this layer needs from the other students' current results, in
 * one query.
 *
 * Two mitigations want the same rows, so they share a single read rather than
 * each paying for one: the change point needs the cohort's mean feature
 * values, and the cohort health flag needs their scores.
 *
 * The shift is how far the cohort itself moved between the baseline period
 * and this assignment, per feature, in cohort-spread units.
 *
 * The student is excluded from their own cohort. Leaving them in would put
 * their deviation into the baseline it is being measured against, diluting
 * exactly the signal this is meant to isolate. With a class of ten that
 * dilution is a tenth of the effect; with a class of three it is a third.
 *
 * Returns unavailable rather than guessing. Early in an assignment nobody
 * else has been scored yet, and the recalibration in File 064 already
 * re-analyses submissions once the cohort fills up, so an early submission
 * gets its shift on the rerun rather than never.
 */
async function cohortPeers(
  assignmentId: string,
  studentId: string,
  calibration: Calibration,
): Promise<{ shift: Shift; saturation: Saturation }> {
  const rows = await DetectionResultModel.find({
    assignment: assignmentId,
    isCurrent: true,
    "behavioral.status": "ok",
    student: { $ne: studentId },
  }).select("behavioral.features behavioral.score");

  const scores = rows
    .map((row) => row.behavioral?.score)
    .filter((value): value is number => typeof value === "number");

  // the score is Math.min(1, ...), so saturation is exactly 1 and needs no
  // tolerance. Below MIN_SATURATION_PEERS the share is left undefined rather
  // than computed from one or two people.
  const saturation: Saturation =
    scores.length >= MIN_SATURATION_PEERS
      ? {
          peers: scores.length,
          share: scores.filter((value) => value >= 1).length / scores.length,
        }
      : { peers: scores.length };

  if (rows.length < MIN_SHIFT_PEERS) {
    return {
      saturation,
      shift: {
        available: false,
        reason: `${rows.length} scored peers in this assignment, ${MIN_SHIFT_PEERS} needed for a cohort shift`,
      },
    };
  }

  const perFeature: Record<string, number> = {};

  for (const feature of SCORED_FEATURES) {
    const values = rows
      .map((row) => row.behavioral?.features?.find((f) => f.feature === feature)?.value)
      .filter((value): value is number => typeof value === "number");
    if (values.length < MIN_SHIFT_PEERS) continue;

    const now = values.reduce((total, value) => total + value, 0) / values.length;
    const then = calibration.mean[feature] ?? 0;
    const stdDev = Math.max(calibration.spread[feature] ?? 0, VARIANCE_FLOOR[feature]);
    perFeature[feature] = (now - then) / stdDev;
  }

  return { saturation, shift: { available: true, perFeature, peers: rows.length } };
}

/**
 * Where this student's own consistency sits in the cohort, as a percentage.
 *
 * The population must not contain the student being ranked. The caller sees
 * to that by passing their id to cohortCalibration.
 */
function percentileOf(value: number, population: number[]): number | undefined {
  if (population.length === 0) return undefined;
  const below = population.filter((other) => other < value).length;
  return (100 * below) / population.length;
}

/** Root mean square, which is the distance in z-space the measurement used. */
function rootMeanSquare(values: number[]): number {
  return Math.sqrt(values.reduce((total, value) => total + value * value, 0) / values.length);
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
  const studentId = String(submission.student);

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

  const usability = baselineUsability(baseline);
  if (!usability.usable) return skip(usability.note ?? "Baseline is not usable");
  // the predicate narrowed it, but only structurally; this is for the compiler
  if (!baseline) return skip("No style baseline for this student yet");

  // this student is left out of the percentile population, and only that
  const calibration = await cohortCalibration(courseId, language, studentId);
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
  // features whose denominator came from VARIANCE_FLOOR rather than from the
  // cohort, meaning nothing in the cohort varied in that feature
  const flooredFeatures: string[] = [];

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
    const cohortSpread = calibration.spread[feature] ?? 0;
    const stdDev = Math.max(cohortSpread, VARIANCE_FLOOR[feature]);
    if (cohortSpread < VARIANCE_FLOOR[feature]) flooredFeatures.push(feature);
    const zScore = (value - mean) / stdDev;

    zScores.push(zScore);
    deviations.push({ feature, value, baselineMean: mean, baselineStdDev: stdDev, zScore });
  }

  if (zScores.length === 0) {
    return skip("No scored feature could be compared against this baseline");
  }

  // Root mean square across the features, then saturated so the score stays
  // inside 0 to 1 without clamping hiding anything.
  const rms = rootMeanSquare(zScores);
  const score = Math.min(1, rms / Z_SATURATION);

  // Mitigation 5, the cohort-controlled change point.
  //
  // The student's shift from their own baseline, root-mean-squared, is
  // already exactly `rms` above: every z-score IS a shift from the baseline
  // mean. So the only new quantity is the cohort's.
  //
  // Both numbers are magnitudes in cohort-spread units, reported side by
  // side so a human can compare them. They are NOT operands to subtract:
  // the root mean square of a difference is not the difference of two root
  // mean squares. Their RATIO is valid, and is the number a review screen
  // should show. The per-feature excess is computed and logged, and
  // deliberately neither stored nor folded into the score, because nothing
  // has yet measured whether an excess-adjusted score separates foreign work
  // better than the raw one. That measurement comes first.
  const { shift, saturation } = await cohortPeers(
    String(submission.assignment),
    studentId,
    calibration,
  );

  let cohortMeanShift: number | undefined;
  let studentShift: number | undefined;
  let excess: number | undefined;

  if (shift.available) {
    const cohortPerFeature = deviations
      .map((d) => shift.perFeature[d.feature])
      .filter((value): value is number => typeof value === "number");

    if (cohortPerFeature.length > 0) {
      cohortMeanShift = rootMeanSquare(cohortPerFeature);
      studentShift = rms;
      excess = rootMeanSquare(
        deviations.map((d) => d.zScore - (shift.perFeature[d.feature] ?? 0)),
      );
    }
  }

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
  // never folded into it. The population excludes this student.
  const percentile = percentileOf(
    baseline.intraStudentVariance ?? 0,
    calibration.variances,
  );
  const lowVariance = {
    flagged: percentile !== undefined && percentile < config.lowVariancePercentile,
    intraStudentVariance: baseline.intraStudentVariance,
    cohortPercentile: percentile,
  };

  // The cohort-level companion to mitigation 4, reported beside the score and
  // never folded into it, for mitigation 4's reason: a flag that quietly
  // changed the number would make the number harder to explain, not easier.
  //
  // Two independent signs that the layer has stopped discriminating. Every
  // denominator floored is the certain one, because the spread is then a
  // constant from this file rather than a measurement. Most of the cohort
  // already pinned at 1 is the observed one.
  const allFloored = flooredFeatures.length === deviations.length;
  const cohortSaturated =
    saturation.share !== undefined && saturation.share >= COHORT_SATURATION_SHARE;
  const cohortHealth = {
    flagged: allFloored || cohortSaturated,
    flooredFeatures,
    saturatedShare: saturation.share,
    peersScored: saturation.peers,
  };

  // Two things can be worth saying at once, so the reason is built up rather
  // than assigned, and capped at the schema's 300 characters.
  const notes: string[] = [];
  if (cohortHealth.flagged) {
    notes.push(
      allFloored
        ? `This cohort shows no measurable spread in ${flooredFeatures.join(", ")}, so the score separates nobody`
        : `${Math.round((saturation.share ?? 0) * 100)}% of scored peers are already at the maximum, so the score separates nobody`,
    );
  }
  if (!sizeMatched) {
    notes.push(
      `Fewer than ${MIN_BAND_ANCHORS} anchors within ${SIZE_BAND_LOW}x to ${SIZE_BAND_HIGH}x of ${submission.lineCount} lines, so all ${baseline.anchors.length} were used`,
    );
  }
  if (!shift.available) notes.push(shift.reason);
  const reason = notes.length > 0 ? notes.join("; ").slice(0, 300) : undefined;

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
      // the population excludes this student, so it is one short of the above
      percentilePopulation: calibration.variances.length,
      lowVariance: lowVariance.flagged,
      cohortHealthFlagged: cohortHealth.flagged,
      flooredFeatures: flooredFeatures.length,
      saturatedShare:
        cohortHealth.saturatedShare === undefined
          ? undefined
          : Number(cohortHealth.saturatedShare.toFixed(4)),
      shiftPeers: shift.available ? shift.peers : 0,
      studentShift: studentShift === undefined ? undefined : Number(studentShift.toFixed(4)),
      cohortMeanShift:
        cohortMeanShift === undefined ? undefined : Number(cohortMeanShift.toFixed(4)),
      // logged, never stored: the number a future measurement would test
      excess: excess === undefined ? undefined : Number(excess.toFixed(4)),
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
    cohortHealth,
    cohortMeanShift,
    studentShift,
    effectiveW2,
  };
}
