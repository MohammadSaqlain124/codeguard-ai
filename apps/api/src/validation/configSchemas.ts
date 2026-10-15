import { z } from "zod";

import { LANGUAGES } from "../models/Assignment.js";
import { objectId } from "./common.js";

// Every tunable below is a proportion, with the same bounds the model gives it.
const weight = z.number().min(0).max(1);

// Validated here as well as in the model's pre-validate hook, on purpose. The
// hook is the guarantee, because a seed script or a future job can write a
// config without passing through this route. This is the message: a bad body
// comes back as a 400 naming the field rather than a 500 from mongoose.
const languageOverride = z
  .object({
    language: z.enum(LANGUAGES),
    reviewThreshold: weight.optional(),
    w1: weight.optional(),
    w2: weight.optional(),
    w3: weight.optional(),
  })
  .strict()
  .refine((o) => o.reviewThreshold !== undefined || o.w1 !== undefined, {
    message: "An override must change something",
  })
  .refine(
    (o) => {
      const given = [o.w1, o.w2, o.w3].filter((v) => v !== undefined).length;
      return given === 0 || given === 3;
    },
    { message: "Set w1, w2 and w3 together or none of them", path: ["w1"] },
  )
  .refine(
    (o) => {
      if (o.w1 === undefined) return true;
      return Math.abs(o.w1 + o.w2! + o.w3! - 1) <= 1e-6;
    },
    { message: "w1 + w2 + w3 must equal 1", path: ["w1"] },
  );

/**
 * The body of a config update.
 *
 * PATCH rather than PUT, matching updateCourseSchema: every field is optional
 * and an omitted one keeps whatever the course already had. The exception is
 * `overrides`, which is a list and so is replaced wholesale when present and
 * left untouched when absent. Sending `"overrides": []` is how you clear them.
 *
 * Requiring the full settings on every save would mean a faculty member had to
 * restate lowVariancePercentile to move a review threshold, which is asking
 * them to have an opinion about a statistic they came here to ignore.
 */
export const updateConfigSchema = z
  .object({
    w1: weight.optional(),
    w2: weight.optional(),
    w3: weight.optional(),
    reviewThreshold: weight.optional(),
    minBaselineConfidence: weight.optional(),
    lowVariancePercentile: z.number().min(0.5).max(25).optional(),
    minAnchorsForBaseline: z.number().int().min(1).max(20).optional(),
    overrides: z.array(languageOverride).max(LANGUAGES.length).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
  .refine(
    (v) => {
      const given = [v.w1, v.w2, v.w3].filter((x) => x !== undefined).length;
      return given === 0 || given === 3;
    },
    { message: "Set w1, w2 and w3 together or none of them", path: ["w1"] },
  )
  .refine(
    (v) => {
      if (v.w1 === undefined) return true;
      return Math.abs(v.w1 + v.w2! + v.w3! - 1) <= 1e-6;
    },
    { message: "w1 + w2 + w3 must equal 1", path: ["w1"] },
  )
  .refine(
    (v) => {
      const languages = (v.overrides ?? []).map((o) => o.language);
      return new Set(languages).size === languages.length;
    },
    { message: "Only one override per language", path: ["overrides"] },
  );

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

// The config hangs off a course, so the route is nested and carries its id.
export const configCourseParams = z.object({ courseId: objectId }).strict();
