import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { env } from "./config/env.js";
import { componentLogger } from "./config/logger.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { initModels, SubmissionModel } from "./models/index.js";
import { DETECTION_QUEUE, type DetectionJob } from "./queue/detectionQueue.js";
import { getSubmission } from "./storage/minio.js";

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

  const source = await getSubmission(submission.objectKey);

  log.info(
    {
      submissionId,
      attempt: job.attemptsMade + 1,
      bytes: source.length,
      lines: submission.lineCount,
      language: submission.language,
    },
    "source loaded",
  );

  // File 058 replaces this line with a call to the detector service.
  // until then the failure is real and visible, which is the honest state.
  throw new Error("Detector service is not implemented yet");
}

const worker = new Worker<DetectionJob>(DETECTION_QUEUE, analyse, {
  connection,
  concurrency: CONCURRENCY,
  // do not start consuming until the database is actually connected
  autorun: false,
});

worker.on("completed", (job, result) => {
  log.info({ jobId: job.id, submissionId: job.data.submissionId, result }, "job done");
});

worker.on("failed", async (job, err) => {
  if (!job) {
    log.error({ err }, "a job failed before it could be read");
    return;
  }
  const allowed = job.opts.attempts ?? 1;
  const isLast = job.attemptsMade >= allowed;

  log.warn(
    { jobId: job.id, submissionId: job.data.submissionId, attempt: job.attemptsMade, of: allowed, reason: err.message },
    isLast ? "job failed for good" : "job failed, will retry",
  );

  // between retries the submission is waiting again, not being analysed
  await setStatus(job.data.submissionId, isLast ? "failed" : "queued", isLast ? err.message : undefined);
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
