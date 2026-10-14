import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
// straight from Assignment rather than the index barrel, which would be a
// cycle: the barrel imports this file. DetectionResult.ts does the same.
import { LANGUAGES } from "./Assignment.js";
import { serialize } from "./plugins.js";

// used when a course has no override row
export const DEFAULT_DETECTION_CONFIG = {
  w1: 0.4,
  w2: 0.3,
  w3: 0.3,
  reviewThreshold: 0.5,
  minBaselineConfidence: 0.4,
  lowVariancePercentile: 5,
  minAnchorsForBaseline: 3,
} as const;

const weight = {
  type: Number,
  required: true,
  min: 0,
  max: 1,
};

// the same bounds without the requirement, for an override that may set some
// fields and leave the rest to the course's own values
const optionalWeight = { type: Number, min: 0, max: 1 };

/**
 * Per-language overrides of the course's settings.
 *
 * The October 2026 measurement found that Java code of coursework size crosses
 * the 0.5 review threshold at 17.3 per cent against Python's 9.4, for honest
 * work by different authors solving different problems. Nearly twice as often,
 * on the same threshold. `language` lives on the assignment while this config
 * is keyed to the course, so a course running one Python and one Java
 * assignment was applying a single threshold to two measurably different
 * distributions.
 *
 * NOTHING HERE CHANGES A DEFAULT. What was measured is that the distributions
 * differ, not what Java's threshold ought to be: there is no labelled
 * plagiarism in the corpora to optimise a weight against. So this makes the
 * difference expressible and leaves every value where it was. A number
 * invented here would be exactly the kind of unmeasured figure this project
 * has already retracted five times.
 *
 * minBaselineConfidence, lowVariancePercentile and minAnchorsForBaseline are
 * deliberately not overridable: they describe how much a baseline is believed,
 * which nothing in the measurement suggests depends on the language.
 */
const languageOverrideSchema = new Schema(
  {
    language: { type: String, required: true, enum: LANGUAGES },
    reviewThreshold: { ...optionalWeight },
    // A weight moves with the other two or not at all, because three weights
    // that do not sum to 1 are not a weighting. The pre-validate hook below
    // enforces that; the schema alone cannot express it.
    w1: { ...optionalWeight },
    w2: { ...optionalWeight },
    w3: { ...optionalWeight },
  },
  { _id: false },
);

const detectionConfigSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      unique: true,
    },
    w1: { ...weight, default: DEFAULT_DETECTION_CONFIG.w1 },
    w2: { ...weight, default: DEFAULT_DETECTION_CONFIG.w2 },
    w3: { ...weight, default: DEFAULT_DETECTION_CONFIG.w3 },

    // RPS at or above this enters the faculty review queue
    reviewThreshold: { ...weight, default: DEFAULT_DETECTION_CONFIG.reviewThreshold },

    // below this baseline confidence, w2 is attenuated toward zero
    minBaselineConfidence: {
      ...weight,
      default: DEFAULT_DETECTION_CONFIG.minBaselineConfidence,
    },

    // intra-student variance below this cohort percentile is flagged
    lowVariancePercentile: {
      type: Number,
      required: true,
      min: 0.5,
      max: 25,
      default: DEFAULT_DETECTION_CONFIG.lowVariancePercentile,
    },

    // fewer invigilated anchors than this means no usable baseline
    minAnchorsForBaseline: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: DEFAULT_DETECTION_CONFIG.minAnchorsForBaseline,
    },

    // At most one entry per language; the pre-validate hook refuses a second.
    overrides: { type: [languageOverrideSchema], default: [] },

    // incremented on every change; snapshotted into DetectionResult
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// floating point: 0.5 + 0.3 + 0.2 is 1.0000000000000002, so compare with epsilon
detectionConfigSchema.pre("validate", function () {
  const sum = this.w1 + this.w2 + this.w3;
  if (Math.abs(sum - 1) > 1e-6) {
    this.invalidate("w1", `w1 + w2 + w3 must equal 1, got ${sum.toFixed(6)}`);
  }

  const seen = new Set<string>();
  for (const [i, override] of (this.overrides ?? []).entries()) {
    if (seen.has(override.language)) {
      this.invalidate(
        `overrides.${i}.language`,
        `${override.language} already has an override on this course`,
      );
    }
    seen.add(override.language);

    // All three or none. A partial triple cannot sum to 1, and silently
    // filling the gaps from the course's values would make the stored
    // override mean something different from what it says.
    const parts = [override.w1, override.w2, override.w3];
    const given = parts.filter((v) => typeof v === "number").length;
    if (given === 0) continue;
    if (given < 3) {
      this.invalidate(
        `overrides.${i}.w1`,
        "an override must set w1, w2 and w3 together or none of them",
      );
      continue;
    }
    const overrideSum = override.w1! + override.w2! + override.w3!;
    if (Math.abs(overrideSum - 1) > 1e-6) {
      this.invalidate(
        `overrides.${i}.w1`,
        `w1 + w2 + w3 must equal 1, got ${overrideSum.toFixed(6)}`,
      );
    }
  }
});

detectionConfigSchema.plugin(serialize);

export type DetectionConfig = InferSchemaType<typeof detectionConfigSchema>;
export type DetectionConfigDoc = HydratedDocument<DetectionConfig>;

export const DetectionConfigModel = model("DetectionConfig", detectionConfigSchema);
