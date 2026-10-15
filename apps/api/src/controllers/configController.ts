import type { Request, Response } from "express";

import { componentLogger } from "../config/logger.js";
import { DEFAULT_DETECTION_CONFIG, DetectionConfigModel } from "../models/DetectionConfig.js";
import { loadCourseFor } from "../services/access.js";
import { recordAudit } from "../services/audit.js";
import type { UpdateConfigInput } from "../validation/configSchemas.js";

const log = componentLogger("config");

// The settings a reader is shown, and the only ones a write may change.
const FIELDS = [
  "w1",
  "w2",
  "w3",
  "reviewThreshold",
  "minBaselineConfidence",
  "lowVariancePercentile",
  "minAnchorsForBaseline",
] as const;

type Field = (typeof FIELDS)[number];

/** A plain settings object, whether it came from a stored row or the defaults. */
type ConfigView = Record<Field, number> & {
  overrides: unknown[];
  version: number;
  isDefault: boolean;
};

function viewOf(row: InstanceType<typeof DetectionConfigModel> | null): ConfigView {
  const source = row ?? DEFAULT_DETECTION_CONFIG;
  const settings = Object.fromEntries(FIELDS.map((f) => [f, source[f]])) as Record<Field, number>;
  return {
    ...settings,
    overrides: row ? row.overrides.map((o) => o.toJSON()) : [],
    // 0 says these are the defaults, which is what configFor records on a
    // result for a course nobody has configured
    version: row ? row.version : 0,
    isDefault: !row,
  };
}

/**
 * Reads the course's detection settings.
 *
 * Staff only, and deliberately so. The review threshold is the number a
 * student would need in order to know exactly how much copying stays under
 * the queue, so this is one of the few reads an enrolled student does not get.
 *
 * Two different refusals, for two different reasons. A student is stopped by
 * the route's role guard with a 403, which leaks nothing because it is true of
 * every course. A faculty member who passed that guard but does not own this
 * course gets the 404 loadCourseFor gives a stranger, because a 403 there
 * would confirm the course exists.
 */
export async function getConfig(req: Request, res: Response) {
  const course = await loadCourseFor(req, "manage");
  const row = await DetectionConfigModel.findOne({ course: course._id });
  res.json({ config: viewOf(row) });
}

/**
 * Changes the course's detection settings.
 *
 * Nothing already scored moves. Every DetectionResult stores the weights that
 * produced it and the configVersion they came from, so this changes what the
 * next analysis does and leaves the record of what the last one did alone.
 * That is the point of versioning them rather than reading the live config
 * when a result is displayed.
 */
export async function updateConfig(req: Request, res: Response) {
  const course = await loadCourseFor(req, "manage");
  const input = req.body as UpdateConfigInput;
  const user = req.user!;

  // A document rather than findOneAndUpdate, because the pre-validate hook on
  // the schema is what refuses a duplicate language or a triple that does not
  // sum to 1, and that hook does not run on an update query.
  const row =
    (await DetectionConfigModel.findOne({ course: course._id })) ??
    new DetectionConfigModel({ course: course._id, updatedBy: user.id });

  const before = viewOf(row.isNew ? null : row);

  for (const field of FIELDS) {
    const value = input[field];
    if (value !== undefined) row[field] = value;
  }

  // Replaced wholesale when present, untouched when absent. A list has no
  // sensible merge: there is no way to say "change the java entry" in a patch
  // body without inventing a syntax for it.
  if (input.overrides !== undefined) {
    row.set("overrides", input.overrides);
  }

  // Bumped on every write, including the first, so version 1 is always a
  // configuration somebody chose and 0 is always the defaults.
  row.version = row.isNew ? 1 : row.version + 1;
  row.updatedBy = user.id as unknown as typeof row.updatedBy;

  await row.save();
  const after = viewOf(row);

  // After the save, so it cannot report a change that did not land, and
  // reporting its own outcome rather than throwing: recordAudit explains why
  // a failed audit must not undo something that already happened.
  const audited = await recordAudit({
    actor: user.id,
    actorRole: user.role,
    action: "config.weights_updated",
    targetType: "DetectionConfig",
    targetId: row.id,
    course: course.id,
    changes: { before, after },
  });

  log.info(
    {
      courseId: course.id,
      version: after.version,
      changed: Object.keys(input),
      by: user.id,
      audited,
    },
    "detection config updated",
  );

  res.json({ config: after, audited });
}
