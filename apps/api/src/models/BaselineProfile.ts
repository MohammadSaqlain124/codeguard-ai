import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { serialize } from "./plugins.js";
import { LANGUAGES, PROVENANCE } from "./Assignment.js";

export const BASELINE_STATUS = ["insufficient", "ready", "stale"] as const;

// A baseline is small by nature, and an array that grows without a limit
// is a document that eventually stops fitting. Twenty is far more than a
// degree produces, and File 073 decides which to keep when it is reached.
export const MAX_ANCHORS = 20;

const score = { type: Number, min: 0, max: 1 };

// one anchor's raw measurements, kept so the baseline can be rebuilt
// without fetching files out of storage again
const anchorValueSchema = new Schema(
  {
    feature: { type: String, required: true, trim: true, maxlength: 60 },
    // deliberately not required. null means the feature did not apply to
    // this file, which is not the same as a measurement of zero, and the
    // difference has to survive being stored.
    value: { type: Number, default: null },
  },
  { _id: false },
);

const anchorSchema = new Schema(
  {
    submission: { type: Schema.Types.ObjectId, ref: "Submission", required: true },
    // kept so an anchor can be traced, or a whole course excluded later,
    // without reading the submission back
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    provenance: { type: String, required: true, enum: PROVENANCE },
    // how far this anchor is believed. Invigilated work is the most
    // trusted; work a member of staff nominated by hand is less so.
    // File 073 sets the actual numbers.
    trust: { ...score, required: true },
    // only set when a person nominated it, so an automatic anchor is
    // distinguishable from a judged one
    nominatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    // a short file makes every feature unreliable, so the size that was
    // measured is part of the evidence
    lineCount: { type: Number, required: true, min: 0 },
    measuredAt: { type: Date, required: true },
    values: { type: [anchorValueSchema], default: [] },
  },
  { _id: false },
);

// one feature's statistics across the anchors that could measure it
const featureStatSchema = new Schema(
  {
    feature: { type: String, required: true, trim: true, maxlength: 60 },
    mean: { type: Number, required: true },
    stdDev: { type: Number, required: true, min: 0 },
    // its own count, not the anchor count. Four anchors can mean four
    // samples for comment density and two for the loop ratio, because a
    // feature that did not apply to an anchor contributes nothing.
    samples: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const baselineProfileSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // a baseline is per language, because the same person writing Java
    // and Python produces different numbers for the same habit
    language: { type: String, required: true, enum: LANGUAGES },

    status: {
      type: String,
      required: true,
      enum: BASELINE_STATUS,
      default: "insufficient",
    },
    // why it is insufficient or stale, in words a person can read
    reason: { type: String, trim: true, maxlength: 300 },

    // which definition of the features these numbers came from. A
    // baseline built on one version is never compared against
    // measurements from another, it is rebuilt.
    featureSetVersion: { type: Number, required: true, min: 1 },
    detectorVersion: { type: String, required: true, trim: true, maxlength: 40 },

    anchors: {
      type: [anchorSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= MAX_ANCHORS,
        message: `A baseline keeps at most ${MAX_ANCHORS} anchors`,
      },
    },
    anchorCount: { type: Number, required: true, min: 0, default: 0 },
    // the anchors' trust added up, which is what confidence derives from.
    // Stored rather than recomputed so a stored confidence can always be
    // explained from the record.
    trustTotal: { type: Number, required: true, min: 0, default: 0 },
    confidence: { ...score, required: true, default: 0 },

    features: { type: [featureStatSchema], default: [] },

    // mitigation 4. A student whose own work barely varies will produce a
    // large deviation for almost any change, so this is measured here and
    // reported on the result rather than folded into a score.
    intraStudentVariance: { type: Number, min: 0 },

    computedAt: { type: Date, required: true, default: Date.now },
    // bumped on every rebuild, so a result can name the baseline it used.
    // The baseline itself is updated in place, which is safe because every
    // DetectionResult stores the mean and standard deviation it was judged
    // against. Interpretation is refreshable; evidence is not.
    revision: { type: Number, required: true, min: 1, default: 1 },
  },
  { timestamps: true },
);

// one baseline per student per language. Also the lock: two workers
// building the same baseline at once means one insert is rejected and its
// job retries, by which time the winner has committed. Same pattern as
// the upload race in File 051.
baselineProfileSchema.index({ student: 1, language: 1 }, { unique: true });

// "which baselines need rebuilding?" for the sweep in File 073
baselineProfileSchema.index({ status: 1, computedAt: 1 });

baselineProfileSchema.plugin(serialize);

export type BaselineProfile = InferSchemaType<typeof baselineProfileSchema>;
export type BaselineProfileDoc = HydratedDocument<BaselineProfile>;

export const BaselineProfileModel = model("BaselineProfile", baselineProfileSchema);
