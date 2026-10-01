import { componentLogger } from "../config/logger.js";
import { BaselineProfileModel } from "../models/BaselineProfile.js";
import { DEFAULT_DETECTION_CONFIG } from "../models/DetectionConfig.js";
import { LANGUAGES } from "../models/index.js";
import { getSubmission } from "../storage/minio.js";
import { extractFeatures } from "./detectorClient.js";
import { findAnchors, isAutomaticAnchor, type Anchor } from "./anchors.js";

const log = componentLogger("baseline");

type Language = (typeof LANGUAGES)[number];

// Two is the smallest number that has a spread at all, since Bessel's
// correction divides by n-1. It is a weak estimate and three would be
// better; the measurement session decides whether to raise it.
export const MIN_SAMPLES_PER_FEATURE = 2;

type Measured = {
  anchor: Anchor;
  values: Record<string, number | null>;
  featureSetVersion: number;
  detectorVersion: string;
};

type FeatureStat = {
  feature: string;
  mean: number;
  stdDev: number;
  samples: number;
};

/**
 * Trust-weighted mean and standard deviation.
 *
 * With equal weights this gives exactly the plain mean and the plain sample
 * standard deviation, whatever the weights are — three anchors at 0.6 and
 * three at 1.0 produce identical numbers. So the common case, a baseline
 * built entirely from invigilated work, needs no defending at all: the
 * weighting only changes anything when anchors disagree about how far they
 * are believed, which is exactly when it should.
 */
function weightedStats(samples: { value: number; weight: number }[]) {
  const weightSum = samples.reduce((total, s) => total + s.weight, 0);
  const mean = samples.reduce((total, s) => total + s.weight * s.value, 0) / weightSum;

  // The effective sample size. Equal weights make this the plain count,
  // which is what makes the paragraph above true.
  const squareSum = samples.reduce((total, s) => total + s.weight * s.weight, 0);
  const effective = (weightSum * weightSum) / squareSum;

  const spread =
    samples.reduce((total, s) => total + s.weight * (s.value - mean) ** 2, 0) / weightSum;

  // Bessel's correction, against the effective size rather than the count,
  // because a sample underestimates the spread of what it came from
  const variance = effective > 1 ? spread * (effective / (effective - 1)) : 0;

  return { mean, stdDev: Math.sqrt(variance), samples: samples.length };
}

/**
 * How far the baseline as a whole is believed.
 *
 * Average trust sets the ceiling and anchor count can only pull it down, so
 * five nominated anchors are never more trustworthy than three nominated
 * ones — more opinions are still opinions. That keeps a nominated-only
 * baseline under 0.6 without a hard gate refusing it outright.
 */
function confidenceFrom(anchors: Anchor[], minAnchors: number): number {
  if (anchors.length === 0) return 0;
  const trustTotal = anchors.reduce((total, anchor) => total + anchor.trust, 0);
  const averageTrust = trustTotal / anchors.length;
  const coverage = Math.min(1, anchors.length / minAnchors);
  return Math.min(1, averageTrust * coverage);
}

/**
 * Mitigation 4's input: how much this student's own work varies.
 *
 * Averaging the raw standard deviations would be decided by
 * avg_line_length alone, which is about 23 where blank_line_ratio is about
 * 0.14. The coefficient of variation is dimensionless, so the features
 * become comparable. Features with a mean of zero are skipped rather than
 * dividing by it.
 */
function dispersion(stats: FeatureStat[]): number | undefined {
  const ratios = stats
    .filter((stat) => stat.mean !== 0)
    .map((stat) => stat.stdDev / Math.abs(stat.mean));
  if (ratios.length === 0) return undefined;
  return ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length;
}

async function measureAll(anchors: Anchor[], language: Language): Promise<Measured[]> {
  const measured = await Promise.all(
    anchors.map(async (anchor): Promise<Measured | null> => {
      try {
        const bytes = await getSubmission(anchor.objectKey);
        const reply = await extractFeatures({
          submissionId: anchor.submissionId,
          language,
          source: bytes.toString("utf8"),
        });

        if (!reply.parsed) {
          // an anchor we cannot measure is not evidence about anybody
          log.warn(
            { submissionId: anchor.submissionId, parseError: reply.parseError },
            "anchor skipped, it will not parse",
          );
          return null;
        }

        return {
          anchor,
          values: reply.features,
          featureSetVersion: reply.featureSetVersion,
          detectorVersion: reply.detectorVersion,
        };
      } catch (err) {
        // one unreadable file must not stop the rest of the baseline
        log.warn({ err, submissionId: anchor.submissionId }, "anchor could not be measured");
        return null;
      }
    }),
  );

  return measured.filter((entry): entry is Measured => entry !== null);
}

function aggregate(measured: Measured[]): FeatureStat[] {
  // The detector returns every declared feature in its canonical order,
  // nulls included, so insertion order here is that order.
  const names = new Set<string>();
  for (const entry of measured) {
    for (const name of Object.keys(entry.values)) names.add(name);
  }

  const stats: FeatureStat[] = [];
  for (const name of names) {
    const samples = measured
      .map((entry) => ({ value: entry.values[name], weight: entry.anchor.trust }))
      .filter((s): s is { value: number; weight: number } => typeof s.value === "number");

    // A feature measured in one anchor has no spread, and storing a
    // standard deviation of zero from a single file would later divide a
    // z-score by nothing. Left out entirely instead, so every stored
    // stdDev means something.
    if (samples.length < MIN_SAMPLES_PER_FEATURE) continue;

    stats.push({ feature: name, ...weightedStats(samples) });
  }

  return stats;
}

/**
 * Build or rebuild one student's baseline for one language.
 *
 * Every anchor is re-measured on every build. Twenty anchors is twenty
 * detector calls at about 3 ms each, so reusing stored values would be an
 * optimisation worth 60 ms and a reconciliation problem. (This corrects
 * what I claimed in File 071: the raw values are stored so faculty can be
 * shown which files produced the mean, not to avoid re-measuring.)
 */
export async function buildBaseline(studentId: string, language: Language) {
  const computedAt = new Date();
  const minAnchors = DEFAULT_DETECTION_CONFIG.minAnchorsForBaseline;

  const candidates = await findAnchors(studentId, language);
  const measured = await measureAll(candidates, language);
  const usable = measured.map((entry) => entry.anchor);

  const features = aggregate(measured);
  const invigilated = usable.filter(isAutomaticAnchor).length;
  const trustTotal = usable.reduce((total, anchor) => total + anchor.trust, 0);
  const confidence = confidenceFrom(usable, minAnchors);

  // Each condition is a different thing being wrong, and the reason is
  // shown to whoever asks why Layer 2 did not run for this student.
  const verdict =
    usable.length === 0
      ? { status: "insufficient" as const, reason: "No anchor could be measured" }
      : invigilated === 0
        ? {
            status: "insufficient" as const,
            reason: "No invigilated anchor, so every sample is a judgement rather than an observation",
          }
        : usable.length < minAnchors
          ? {
              status: "insufficient" as const,
              reason: `${usable.length} usable anchors against a minimum of ${minAnchors}`,
            }
          : features.length === 0
            ? {
                status: "insufficient" as const,
                reason: `No feature was measured in at least ${MIN_SAMPLES_PER_FEATURE} anchors`,
              }
            : { status: "ready" as const, reason: "" };

  // The detector's own versions, taken from the measurements rather than
  // assumed, so a baseline always records what produced it.
  const featureSetVersion = measured[0]?.featureSetVersion ?? 1;
  const detectorVersion = measured[0]?.detectorVersion ?? "unknown";

  const anchorDocs = measured.map((entry) => ({
    submission: entry.anchor.submissionId,
    assignment: entry.anchor.assignmentId,
    course: entry.anchor.courseId,
    provenance: entry.anchor.provenance,
    trust: entry.anchor.trust,
    lineCount: entry.anchor.lineCount,
    measuredAt: computedAt,
    values: Object.entries(entry.values).map(([feature, value]) => ({ feature, value })),
  }));

  const fields = {
    status: verdict.status,
    reason: verdict.reason,
    featureSetVersion,
    detectorVersion,
    anchors: anchorDocs,
    anchorCount: usable.length,
    trustTotal,
    confidence,
    features,
    intraStudentVariance: dispersion(features),
    computedAt,
  };

  // Read then write, with the unique index on { student, language } as the
  // lock. Two jobs racing both try to insert, one is rejected with 11000,
  // its job retries, and by then the winner has committed. Same pattern as
  // the revision lock in File 066.
  const existing = await BaselineProfileModel.findOne({ student: studentId, language });

  let saved;
  if (existing) {
    Object.assign(existing, fields);
    existing.revision += 1;
    saved = await existing.save();
  } else {
    saved = await BaselineProfileModel.create({
      student: studentId,
      language,
      revision: 1,
      ...fields,
    });
  }

  log.info(
    {
      student: studentId,
      language,
      status: verdict.status,
      reason: verdict.reason || undefined,
      candidates: candidates.length,
      usable: usable.length,
      invigilated,
      confidence: Number(confidence.toFixed(4)),
      features: features.length,
      revision: saved.revision,
    },
    "baseline built",
  );

  return {
    baselineId: saved.id as string,
    status: verdict.status,
    reason: verdict.reason,
    anchorCount: usable.length,
    invigilated,
    confidence,
    featureCount: features.length,
    revision: saved.revision,
  };
}
