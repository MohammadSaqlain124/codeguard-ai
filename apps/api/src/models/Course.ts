import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { serialize } from "./plugins.js";

const courseSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // "2026-27" — the same code runs again each year
    academicYear: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    faculty: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    enrolledStudents: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// a course code is unique within a year, not across all time
courseSchema.index({ code: 1, academicYear: 1 }, { unique: true });

courseSchema.plugin(serialize);

export type Course = InferSchemaType<typeof courseSchema>;
export type CourseDoc = HydratedDocument<Course>;

export const CourseModel = model("Course", courseSchema);
