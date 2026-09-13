import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

import { LANGUAGES, PROVENANCE } from "./Assignment.js";

export const SUBMISSION_STATUS = [
  "uploaded",
  "queued",
  "analyzing",
  "analyzed",
  "failed",
] as const;

const submissionSchema = new Schema(
  {
    assignment: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // 1, 2, 3... within this student's submissions to this assignment
    attempt: {
      type: Number,
      required: true,
      min: 1,
    },
    // copied from the assignment at creation, never updated afterwards
    provenance: {
      type: String,
      required: true,
      enum: PROVENANCE,
    },
    language: {
      type: String,
      required: true,
      enum: LANGUAGES,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    // key in the MinIO submissions bucket
    objectKey: {
      type: String,
      required: true,
      unique: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    // sha-256 hex; identical content gives an identical hash
    contentHash: {
      type: String,
      required: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      index: true,
    },
    lineCount: {
      type: Number,
      required: true,
      min: 0,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isLate: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      required: true,
      enum: SUBMISSION_STATUS,
      default: "uploaded",
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // set true only after all three layers pass and faculty confirm
    baselineEligible: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true },
);

// one attempt number per student per assignment
submissionSchema.index({ assignment: 1, student: 1, attempt: 1 }, { unique: true });

// the Layer 2 anchor query: this student's invigilated work
submissionSchema.index({ student: 1, provenance: 1, language: 1 });

// the worker: "what needs processing?"
submissionSchema.index({ status: 1, submittedAt: 1 });

submissionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as Record<string, unknown>;
    delete obj.__v;
    delete obj.objectKey;
    return obj;
  },
});

export type Submission = InferSchemaType<typeof submissionSchema>;
export type SubmissionDoc = HydratedDocument<Submission>;

export const SubmissionModel = model("Submission", submissionSchema);
