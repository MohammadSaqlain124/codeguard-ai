import { z } from "zod";
import { objectId, pagination, queryBoolean } from "./common.js";
import { rollNo } from "./authSchemas.js";

// "CS-501", "BCSE-301A": letters, digits and hyphens, stored uppercase
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Use letters, digits and hyphens, like CS-501");

const title = z.string().trim().min(3, "Must be at least 3 characters").max(200);

// "2026-27": the second year must follow the first
const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, "Must look like 2026-27")
  .refine((v) => Number(v.slice(5)) === (Number(v.slice(0, 4)) + 1) % 100, {
    message: "Years must be consecutive, like 2026-27",
  });

// duplicates are removed after rollNo has normalised each entry
const rollNoList = z
  .array(rollNo)
  .min(1, "Give at least one roll number")
  .max(200, "At most 200 at a time")
  .transform((list) => [...new Set(list)]);

// faculty is optional here; the controller decides by role
// (an admin must name the faculty, a faculty member creates for themselves)
export const createCourseSchema = z
  .object({
    code,
    title,
    academicYear,
    faculty: objectId.optional(),
  })
  .strict();

// code and academicYear are the course's identity, so they are not editable
export const updateCourseSchema = z
  .object({
    title: title.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// the same body for enrolling and for removing students
export const enrolmentSchema = z.object({ rollNos: rollNoList }).strict();

export const courseIdParams = z.object({ courseId: objectId }).strict();

export const listCoursesQuery = z
  .object({
    ...pagination,
    archived: queryBoolean.optional(),
    academicYear: academicYear.optional(),
  })
  .strict();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type EnrolmentInput = z.infer<typeof enrolmentSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuery>;
