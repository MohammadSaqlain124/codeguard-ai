import { z } from "zod";

import { LANGUAGES, PROVENANCE } from "../models/Assignment.js";
import { objectId, pagination, queryBoolean } from "./common.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const title = z.string().trim().min(3, "Must be at least 3 characters").max(200);
const description = z.string().trim().max(5000);

// The deadline must carry its timezone ("Z" or "+05:30"). Without one,
// new Date() reads the time in the server's own timezone: IST on a laptop,
// UTC in Docker. The same text would then mean two different deadlines.
const dueAt = z.iso
  .datetime({ offset: true, message: "Use a full date and time with a timezone, like 2026-10-01T23:59:00+05:30" })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() > Date.now(), { message: "Must be in the future" })
  .refine((d) => d.getTime() < Date.now() + 366 * DAY_MS, { message: "Must be within a year" });

const language = z.enum(LANGUAGES);

// "unknown" exists for imported data only; faculty must choose one of the other two
const provenance = z.enum(PROVENANCE).exclude(["unknown"]);

const maxSubmissions = z.number().int().min(1).max(20);

// the course comes from the URL (/courses/:courseId/assignments), never the body
export const createAssignmentSchema = z
  .object({
    title,
    description: description.optional(),
    language,
    provenance: provenance.optional(),
    dueAt,
    acceptsLate: z.boolean().optional(),
    maxSubmissions: maxSubmissions.optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();

// language and provenance are accepted here, but the controller refuses to
// change them once any student has submitted
export const updateAssignmentSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    language: language.optional(),
    provenance: provenance.optional(),
    dueAt: dueAt.optional(),
    acceptsLate: z.boolean().optional(),
    maxSubmissions: maxSubmissions.optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const assignmentIdParams = z.object({ assignmentId: objectId }).strict();

export const listAssignmentsQuery = z
  .object({
    ...pagination,
    published: queryBoolean.optional(),
  })
  .strict();

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuery>;
