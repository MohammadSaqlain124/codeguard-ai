import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

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
});

detectionConfigSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as Record<string, unknown>;
    delete obj.__v;
    return obj;
  },
});

export type DetectionConfig = InferSchemaType<typeof detectionConfigSchema>;
export type DetectionConfigDoc = HydratedDocument<DetectionConfig>;

export const DetectionConfigModel = model("DetectionConfig", detectionConfigSchema);
