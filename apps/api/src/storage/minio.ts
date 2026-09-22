import { randomUUID } from "node:crypto";
import { Client } from "minio";

import { env } from "../config/env.js";
import { componentLogger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";

const log = componentLogger("storage");

export const storageClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
});

const bucket = env.MINIO_BUCKET;

// Creates the bucket at startup if it's missing, so a fresh
// `docker compose down -v` no longer needs a trip to the MinIO console.
export async function ensureBucket() {
  if (await storageClient.bucketExists(bucket)) {
    log.info({ bucket }, "bucket ready");
    return;
  }
  try {
    await storageClient.makeBucket(bucket);
    log.info({ bucket }, "bucket created");
  } catch (err: any) {
    // another API instance may have created it a moment ago
    if (err?.code !== "BucketAlreadyOwnedByYou") throw err;
  }
}

// Keys are built from ids only. The student's filename is kept in Mongo,
// never in the key, so odd characters or "../" in a filename can't matter.
export function submissionKey(assignmentId: string, studentId: string) {
  return `${assignmentId}/${studentId}/${randomUUID()}`;
}

export async function putSubmission(key: string, content: Buffer) {
  try {
    // octet-stream: if a file is ever served back through a link,
    // browsers download it instead of trying to render it
    await storageClient.putObject(bucket, key, content, content.length, {
      "Content-Type": "application/octet-stream",
    });
  } catch (err) {
    log.error({ err, key }, "upload to storage failed");
    throw AppError.dependencyUnavailable("storage");
  }
}

export async function getSubmission(key: string) {
  try {
    const stream = await storageClient.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  } catch (err: any) {
    if (err?.code === "NoSuchKey") throw AppError.notFound("File");
    log.error({ err, key }, "read from storage failed");
    throw AppError.dependencyUnavailable("storage");
  }
}

// Undoes an upload when saving the submission record fails afterwards.
// It never throws: the caller is already handling a more important error.
export async function removeSubmission(key: string) {
  try {
    await storageClient.removeObject(bucket, key);
  } catch (err) {
    log.error({ err, key }, "could not remove object; it is now an orphan");
  }
}
