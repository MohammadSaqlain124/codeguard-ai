import { DEFAULT_DETECTION_CONFIG, DetectionConfigModel } from "../models/DetectionConfig.js";
import type { LANGUAGES } from "../models/Assignment.js";

type Language = (typeof LANGUAGES)[number];

/**
 * The settings that actually applied to one analysis.
 *
 * A plain object rather than a document, because three different callers read
 * it and none of them should care whether a course had a row at all, whether a
 * language override existed, or which of the two supplied each field.
 */
export type EffectiveConfig = {
  w1: number;
  w2: number;
  w3: number;
  reviewThreshold: number;
  minBaselineConfidence: number;
  lowVariancePercentile: number;
  minAnchorsForBaseline: number;
  /** the stored row's version, or 0 when the course has no row at all */
  version: number;
  /** whether a per-language override contributed anything */
  languageOverride: boolean;
};

/**
 * Resolves the configuration for one course and one language.
 *
 * Three layers, each falling back to the one below: a per-language override,
 * then the course's own row, then DEFAULT_DETECTION_CONFIG.
 *
 * It exists because `language` is a property of the assignment while the
 * config is keyed to the course, so the two could not previously meet. The
 * October measurement made that a real problem rather than a tidiness one:
 * Java crosses the review threshold roughly twice as often as Python on
 * honest work, and a course may run both.
 *
 * Reading the override is all-or-nothing for the weights, which the schema's
 * pre-validate hook guarantees. Mixing an overridden w1 with an inherited w2
 * would produce a triple that does not sum to 1, and the whole point of the
 * hook is that such a triple never reaches storage.
 */
export async function configFor(courseId: string, language: string): Promise<EffectiveConfig> {
  const row = await DetectionConfigModel.findOne({ course: courseId });
  const base = row ?? DEFAULT_DETECTION_CONFIG;
  const override = row?.overrides?.find((entry) => entry.language === (language as Language));

  // testing one is enough: the schema refuses a partial triple
  const weighted = override && typeof override.w1 === "number";

  return {
    w1: weighted ? override.w1! : base.w1,
    w2: weighted ? override.w2! : base.w2,
    w3: weighted ? override.w3! : base.w3,
    reviewThreshold: override?.reviewThreshold ?? base.reviewThreshold,
    // Not overridable, deliberately. These three describe how far a baseline
    // is believed, and nothing measured suggests that depends on the
    // language the baseline is built from.
    minBaselineConfidence: base.minBaselineConfidence,
    lowVariancePercentile: base.lowVariancePercentile,
    minAnchorsForBaseline: base.minAnchorsForBaseline,
    // 0 rather than 1, so a stored result says which of the two it was:
    // the defaults, or the first config a faculty member saved
    version: row ? row.version : 0,
    languageOverride: Boolean(override),
  };
}
