import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { serialize } from "./plugins.js";
import { LANGUAGES } from "./Assignment.js";

export const LAYER_STATUS = ["ok", "skipped", "failed"] as const;
export const REVIEW_STATUS = [
  "pending",
  "dismissed",
  "contested",
  "escalated",
  "confirmed_clean",
] as const;

const score = { type: Number, min: 0, max: 1 };

// ---- Layer 1: structural ----

// one line-range pair inside a match
const spanSchema = new Schema(
  {
    aStart: { type: Number, required: true, min: 1 },
    aEnd: { type: Number, required: true, min: 1 },
    bStart: { type: Number, required: true, min: 1 },
    bEnd: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const structuralMatchSchema = new Schema(
  {
    otherSubmission: { type: Schema.Types.ObjectId, ref: "Submission", required: true },
    otherStudent: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // raw APTED-derived similarity
    similarity: { ...score, required: true },
    // how unusual this is against the cohort's distribution for this assignment
    cohortZScore: { type: Number, required: true },
    // which transformation level of the harness this resembles, if identifiable
    obfuscationLevel: { type: Number, min: 1, max: 6 },
    spans: { type: [spanSchema], default: [] },
  },
  { _id: false },
);

// ---- Layer 2: behavioral ----

const featureDeviationSchema = new Schema(
  {
    feature: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: Number, required: true },
    baselineMean: { type: Number, required: true },
    baselineStdDev: { type: Number, required: true, min: 0 },
    zScore: { type: Number, required: true },
  },
  { _id: false },
);

// ---- Layer 3: ai-content ----

const tokenAttributionSchema = new Schema(
  {
    token: { type: String, required: true, maxlength: 120 },
    line: { type: Number, required: true, min: 1 },
    attribution: { type: Number, required: true },
  },
  { _id: false },
);

const windowScoreSchema = new Schema(
  {
    startLine: { type: Number, required: true, min: 1 },
    endLine: { type: Number, required: true, min: 1 },
    // temperature-scaled, so it is a calibrated probability
    probability: { ...score, required: true },
  },
  { _id: false },
);

// ---- the result ----

const detectionResultSchema = new Schema(
  {
    submission: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
      index: true,
    },
    // results are versioned, never overwritten
    revision: { type: Number, required: true, min: 1, default: 1 },
    isCurrent: { type: Boolean, required: true, default: true },

    // denormalised so the review queue needs no joins
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    language: { type: String, required: true, enum: LANGUAGES },

    structural: {
      status: { type: String, required: true, enum: LAYER_STATUS, default: "skipped" },
      reason: { type: String, trim: true, maxlength: 300 },
      durationMs: { type: Number, min: 0 },
      score: score,
      // set when contentHash matched another submission exactly
      exactDuplicateOf: { type: Schema.Types.ObjectId, ref: "Submission" },
      candidatesConsidered: { type: Number, min: 0 },
      matches: { type: [structuralMatchSchema], default: [] },
    },

    behavioral: {
      status: { type: String, required: true, enum: LAYER_STATUS, default: "skipped" },
      reason: { type: String, trim: true, maxlength: 300 },
      durationMs: { type: Number, min: 0 },
      score: score,
      // trust-weighted, from the anchors available
      baselineConfidence: { ...score },
      anchorCount: { type: Number, min: 0 },
      features: { type: [featureDeviationSchema], default: [] },
      // mitigation 4 — reported separately, never folded into score
      lowVariance: {
        flagged: { type: Boolean, default: false },
        intraStudentVariance: { type: Number, min: 0 },
        cohortPercentile: { type: Number, min: 0, max: 100 },
      },
      // cohort-controlled change point
      cohortMeanShift: { type: Number },
      studentShift: { type: Number },
    },

    aiContent: {
      status: { type: String, required: true, enum: LAYER_STATUS, default: "skipped" },
      reason: { type: String, trim: true, maxlength: 300 },
      durationMs: { type: Number, min: 0 },
      score: score,
      baselineModelScore: { ...score },
      modelName: { type: String, trim: true, maxlength: 120 },
      windows: { type: [windowScoreSchema], default: [] },
      topAttributions: { type: [tokenAttributionSchema], default: [] },
    },

    // ---- aggregation ----
    rps: { ...score, required: true, index: true },
    // exactly what produced the rps above
    weights: {
      w1: { ...score, required: true },
      w2: { ...score, required: true },
      w3: { ...score, required: true },
      // w2 after baseline-confidence attenuation
      effectiveW2: { ...score, required: true },
    },
    configVersion: { type: Number, required: true, min: 1 },
    detectorVersion: { type: String, required: true, trim: true, maxlength: 40 },

    // surfaced, not averaged away
    signalDisagreement: { type: Boolean, required: true, default: false },

    computedAt: { type: Date, required: true, default: Date.now },
    totalDurationMs: { type: Number, min: 0 },

    // the one mutable region
    review: {
      status: { type: String, required: true, enum: REVIEW_STATUS, default: "pending" },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
      note: { type: String, trim: true, maxlength: 2000 },
      studentExplanation: { type: String, trim: true, maxlength: 2000 },
      explainedAt: { type: Date },
    },
  },
  { timestamps: true },
);

// one result per submission per revision
detectionResultSchema.index({ submission: 1, revision: 1 }, { unique: true });

// the review queue: this assignment, current results, highest rps first
detectionResultSchema.index({ assignment: 1, isCurrent: 1, rps: -1 });

// faculty dashboard: unreviewed work across a course
detectionResultSchema.index({ course: 1, "review.status": 1, rps: -1 });

detectionResultSchema.plugin(serialize);

export type DetectionResult = InferSchemaType<typeof detectionResultSchema>;
export type DetectionResultDoc = HydratedDocument<DetectionResult>;

export const DetectionResultModel = model("DetectionResult", detectionResultSchema);
