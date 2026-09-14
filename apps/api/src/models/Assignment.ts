import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { serialize } from "./plugins.js";

export const LANGUAGES = ["python", "java"] as const;
export const PROVENANCE = ["invigilated", "takehome", "unknown"] as const;

const assignmentSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    // decides which tree-sitter grammar the detector loads
    language: {
      type: String,
      required: true,
      enum: LANGUAGES,
    },
    // inherited by every submission; only invigilated work is baseline-eligible
    provenance: {
      type: String,
      required: true,
      enum: PROVENANCE,
      default: "takehome",
    },
    dueAt: {
      type: Date,
      required: true,
    },
    // late work is still analysed, just marked
    acceptsLate: {
      type: Boolean,
      default: true,
    },
    maxSubmissions: {
      type: Number,
      default: 3,
      min: 1,
      max: 20,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

// a title is unique within its course, not across the system
assignmentSchema.index({ course: 1, title: 1 }, { unique: true });

// review queue: "open assignments for this course, soonest first"
assignmentSchema.index({ course: 1, dueAt: -1 });

assignmentSchema.plugin(serialize);

export type Assignment = InferSchemaType<typeof assignmentSchema>;
export type AssignmentDoc = HydratedDocument<Assignment>;

export const AssignmentModel = model("Assignment", assignmentSchema);
