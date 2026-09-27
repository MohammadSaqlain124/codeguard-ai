import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { componentLogger } from "../config/logger.js";

const log = componentLogger("queue");

export const DETECTION_QUEUE = "detection";

// two kinds of work share one queue, told apart by the job's name
export const ANALYSE_JOB = "analyse";
export const RECALIBRATE_JOB = "recalibrate";

export type DetectionJob = {
  submissionId: string;
  // why the job exists, so the worker and the logs can tell them apart
  reason: "upload" | "rerun";
};

export type RecalibrateJob = {
  assignmentId: string;
};

export type QueueJob = DetectionJob | RecalibrateJob;

// BullMQ needs a connection that never gives up on a command, because a
// blocking read can wait minutes for the next job. Our shared client from
// File 038 is configured with maxRetriesPerRequest: 3, which BullMQ rejects.
const connection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

connection.on("error", (err: Error) => log.error({ err }, "queue redis error"));

export const detectionQueue = new Queue<QueueJob>(DETECTION_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    // 5s, then 25s: a restarting detector is usually back within that
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    // keep failures for a week; they are the ones worth looking at
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  },
});

/**
 * Adds a submission to the detection queue. Returns true if it was queued.
 * Never throws: a stored submission must not be lost because Redis blinked.
 */
export async function enqueueDetection(submissionId: string, reason: DetectionJob["reason"] = "upload") {
  try {
    await detectionQueue.add(
      ANALYSE_JOB,
      { submissionId, reason },
      {
        // the same submission cannot be queued twice while one is waiting
        jobId: `sub-${submissionId}-${reason}`,
        // A job id stays reserved while the finished job is retained, and
        // completed jobs are kept for a day. A re-analysis must be able to
        // happen again an hour later, so reruns are not retained.
        ...(reason === "rerun" ? { removeOnComplete: true, removeOnFail: true } : {}),
      },
    );
    log.info({ submissionId, reason }, "queued for detection");
    return true;
  } catch (err) {
    log.error({ err, submissionId }, "could not queue submission; it stays 'uploaded'");
    return false;
  }
}

/**
 * Asks for an assignment's results to be brought up to date. One waiting
 * job per assignment, so sixty uploads at a deadline collapse into a
 * handful of runs rather than sixty.
 */
export async function enqueueRecalibration(assignmentId: string) {
  try {
    await detectionQueue.add(
      RECALIBRATE_JOB,
      { assignmentId },
      { jobId: `recal-${assignmentId}`, removeOnComplete: true, removeOnFail: true, attempts: 2 },
    );
    return true;
  } catch (err) {
    log.error({ err, assignmentId }, "could not queue recalibration");
    return false;
  }
}

export async function closeQueue() {
  await detectionQueue.close();
  await connection.quit();
  log.info("queue connection closed");
}
