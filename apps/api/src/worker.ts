import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { env } from "./config/env.js";
import { componentLogger } from "./config/logger.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { initModels, LANGUAGES, SubmissionModel } from "./models/index.js";
import {
  ANALYSE_JOB,
  DETECTION_QUEUE,
  RECALIBRATE_JOB,
  REBUILD_BASELINE_JOB,
  enqueueBaselineRebuild,
  type DetectionJob,
  type QueueJob,
  type RebuildBaselineJob,
  type RecalibrateJob,
} from "./queue/detectionQueue.js";
import { isAnchor } from "./services/anchors.js";
import { buildBaseline } from "./services/baseline.js";
import { runDetection } from "./services/detection.js";
import { recalibrateAssignment } from "./services/recalibrate.js";

const log = componentLogger("worker");

// two at a time. one lets a single slow file block everything behind it,
// and more than two would fight the api, mongo and minio for one laptop
const CONCURRENCY = 2;

// BullMQ blocks while waiting for work, so this connection must never
// give up on a command. the shared client in db/redis.ts uses 3 retries.
const connection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

connection.on("error", (err: Error) => log.error({ err }, "worker redis error"));

type Language = (typeof LANGUAGES)[number];

/**
 * Job data is JSON that has been through Redis, so it arrives back untyped
 * whatever the TypeScript says. Same reasoning as validating the
 * detector's HTTP response rather than trusting it.
 */
function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

async function setStatus(submissionId: string, status: "queued" | "failed", reason?: string) {
  try {
    await SubmissionModel.updateOne(
      { _id: submissionId },
      // the schema caps failureReason at 500 characters
      { status, failureReason: reason ? reason.slice(0, 500) : undefined },
    );
  } catch (err) {
    log.error({ err, submissionId, status }, "could not record the outcome");
  }
}

async function analyse(job: Job<DetectionJob>) {
  const { submissionId, reason } = job.data;
  const submission = await SubmissionModel.findById(submissionId);

  // the job outlived its submission: a wiped test database, or a deleted record
  if (!submission) {
    log.warn({ jobId: job.id, submissionId }, "submission no longer exists, dropping the job");
    return { skipped: "submission not found" };
  }

  // a re-run is deliberate, an upload job arriving twice is not
  if (submission.status === "analyzed" && reason === "upload") {
    log.info({ submissionId }, "already analysed, nothing to do");
    return { skipped: "already analysed" };
  }

  submission.status = "analyzing";
  // set() rather than assignment, because clearing an optional path is
  // the one case where mongoose and typescript disagree
  submission.set("failureReason", undefined);
  await submission.save();

  // Runs while this submission is still "analyzing", which matters:
  // findAnchors only considers submissions already marked "analyzed", so a
  // submission can never anchor the baseline that judges it. Moving the
  // save below to before this line would quietly break that.
  const outcome = await runDetection(submission);

  submission.status = "analyzed";
  await submission.save();

  // Now that it counts as an anchor, the student's baseline is out of date.
  // The job id is derived from the student and language, so four anchors in
  // one sitting collapse into one rebuild.
  if (isAnchor(submission)) {
    await enqueueBaselineRebuild(String(submission.student), submission.language);
  }

  return {
    rps: Number(outcome.rps.toFixed(4)),
    structural: outcome.structuralStatus,
    behavioural: outcome.behaviouralStatus,
    matches: outcome.matchCount,
  };
}

async function rebuild(job: Job<RebuildBaselineJob>) {
  const { studentId, language } = job.data;

  if (!isLanguage(language)) {
    log.warn({ jobId: job.id, studentId, language }, "unknown language, dropping the rebuild");
    return { skipped: `unknown language ${language}` };
  }

  return buildBaseline(studentId, language);
}

async function handleJob(job: Job<QueueJob>) {
  // job.name is the discriminant here, because the payload types carry no
  // tag of their own
  if (job.name === RECALIBRATE_JOB) {
    const { assignmentId } = job.data as RecalibrateJob;
    return recalibrateAssignment(assignmentId);
  }
  if (job.name === REBUILD_BASELINE_JOB) {
    return rebuild(job as Job<RebuildBaselineJob>);
  }
  return analyse(job as Job<DetectionJob>);
}

const worker = new Worker<QueueJob>(DETECTION_QUEUE, handleJob, {
  connection,
  concurrency: CONCURRENCY,
  // do not start consuming until the database is actually connected
  autorun: false,
});

worker.on("completed", (job, result) => {
  log.info({ jobId: job.id, name: job.name, result }, "job done");
});

worker.on("failed", async (job, err) => {
  if (!job) {
    log.error({ err }, "a job failed before it could be read");
    return;
  }
  const allowed = job.opts.attempts ?? 1;
  const isLast = job.attemptsMade >= allowed;

  log.warn(
    { jobId: job.id, name: job.name, attempt: job.attemptsMade, of: allowed, reason: err.message },
    isLast ? "job failed for good" : "job failed, will retry",
  );

  // Only an analyse job carries a submission whose status can be recorded.
  // Written as "is this an analyse job" rather than "is this not a
  // recalibration", because a list of exceptions is what breaks the moment
  // a third kind of job appears, which is exactly what happened here.
  if (job.name !== ANALYSE_JOB) return;

  const { submissionId } = job.data as DetectionJob;
  // between retries the submission is waiting again, not being analysed
  await setStatus(submissionId, isLast ? "failed" : "queued", isLast ? err.message : undefined);
});

worker.on("error", (err) => log.error({ err }, "worker error"));

async function start() {
  await connectDb();
  await initModels();
  await connectRedis();

  // not awaited: run() only settles when the worker stops
  void worker.run();
  log.info({ queue: DETECTION_QUEUE, concurrency: CONCURRENCY }, "worker ready, waiting for jobs");
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutting down, finishing the jobs in flight first");
  // close() waits for active jobs instead of abandoning them half done
  await worker.close();
  await connection.quit();
  await disconnectRedis();
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch((err) => {
  log.error({ err }, "worker failed to start");
  process.exit(1);
});
