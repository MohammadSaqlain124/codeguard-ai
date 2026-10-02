import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { serialize } from "./plugins.js";
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
    // True when faculty have nominated this work by hand, for a student with
    // no invigilated work to anchor on. Layer 1 must have run and found
    // nothing. Layer 2 is deliberately NOT required: this is the work its
    // baseline is built from, so it cannot be its own precondition. The full
    // rule lives in eligibilityFor() in services/anchors.ts.
    baselineEligible: {
      type: Boolean,
      required: true,
      default: false,
    },
    // Who nominated it, and when. The AuditLog holds the event; these hold
    // the current state, so a faculty list can show "nominated by X" without
    // a query per row. Both are cleared when a nomination is withdrawn.
    nominatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    nominatedAt: {
      type: Date,
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

submissionSchema.plugin(serialize, { hide: ["objectKey"] });

export type Submission = InferSchemaType<typeof submissionSchema>;
export type SubmissionDoc = HydratedDocument<Submission>;

export const SubmissionModel = model("Submission", submissionSchema);
