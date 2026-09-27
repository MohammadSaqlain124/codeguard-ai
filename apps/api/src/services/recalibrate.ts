import { componentLogger } from "../config/logger.js";
import { SubmissionModel } from "../models/index.js";
import { DetectionResultModel } from "../models/DetectionResult.js";
import { enqueueDetection } from "../queue/detectionQueue.js";

const log = componentLogger("recalibrate");

// a guard against a runaway, not a tuning knob
const MAX_REANALYSES_PER_RUN = 100;

function meanAndStdDev(values: number[]) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  // divide by n-1, not n: these are a sample of the possible pairings,
  // not the whole population, and n-1 corrects the usual underestimate
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

export async function recalibrateAssignment(assignmentId: string) {
  const newest = await SubmissionModel.findOne({ assignment: assignmentId })
    .sort({ submittedAt: -1 })
    .select("submittedAt");

  if (!newest) return { reanalysed: 0, samples: 0 };

  // A result computed before the newest submission arrived was compared
  // against an incomplete cohort. No statistic can repair that: the
  // comparison itself has to happen again.
  const stale = await DetectionResultModel.find({
    assignment: assignmentId,
    isCurrent: true,
    computedAt: { $lt: newest.submittedAt },
  })
    .limit(MAX_REANALYSES_PER_RUN)
    .select("submission");

  if (stale.length > 0) {
    for (const result of stale) {
      await enqueueDetection(String(result.submission), "rerun");
    }
    log.info({ assignmentId, count: stale.length }, "re-analysing against the fuller cohort");
    // each re-analysis asks for another recalibration when it finishes,
    // so the statistics wait until nothing is stale
    return { reanalysed: stale.length, samples: 0 };
  }

  const results = await DetectionResultModel.find({ assignment: assignmentId, isCurrent: true });
  const samples = results.flatMap((r) => (r.structural?.matches ?? []).map((m) => m.similarity));

  // one pair tells you nothing about how unusual it is
  const stats = samples.length >= 2 ? meanAndStdDev(samples) : { mean: 0, stdDev: 0 };
  const computedAt = new Date();

  for (const result of results) {
    if (!result.structural) continue;
    for (const match of result.structural.matches ?? []) {
      // with no spread there is nothing to be unusual against
      match.cohortZScore =
        stats.stdDev > 0 ? Number(((match.similarity - stats.mean) / stats.stdDev).toFixed(4)) : 0;
    }
    result.structural.cohortSampleSize = samples.length;
    result.structural.cohortComputedAt = computedAt;
    // mongoose does not always notice a change inside a nested path
    result.markModified("structural");
    await result.save();
  }

  log.info(
    {
      assignmentId,
      results: results.length,
      samples: samples.length,
      mean: Number(stats.mean.toFixed(4)),
      stdDev: Number(stats.stdDev.toFixed(4)),
    },
    "cohort statistics written",
  );

  return { reanalysed: 0, samples: samples.length, ...stats };
}
