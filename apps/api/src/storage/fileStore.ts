import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import { componentLogger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";

const log = componentLogger("storage");

// Submitted source files are kept in Mongo rather than in an object store.
//
// The object store was the right shape for arbitrary user uploads, but these
// are not arbitrary: ALLOWED_EXTENSIONS is .py and .java, and multer refuses
// anything over MAX_UPLOAD_BYTES, which is 1 MB. A Mongo document holds 16 MB,
// so every file we accept fits with fifteen times the room to spare.
//
// What that buys is one fewer service to run, one fewer set of credentials to
// hold, and one fewer thing that can be unreachable while a student is trying
// to submit. The cost is that the database carries bytes it does not search.
//
// This is deliberately not what you would do at scale. If submissions ever
// grow past a megabyte, or the collection starts to crowd the cluster, the
// four functions below are the whole interface and an S3 client slots back in
// behind them without touching a caller.
const COLLECTION = "submissionfiles";

function files() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("file store used before mongo was connected");
  return db.collection(COLLECTION);
}

// The driver returns BSON binary as a Binary wrapper or as a Buffer depending
// on options we do not set here, so accept both. Pinning this down in one
// place means a driver upgrade cannot quietly change what callers receive.
function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const binary = value as { buffer?: Uint8Array };
  if (binary?.buffer) return Buffer.from(binary.buffer);
  throw new Error("stored file was not binary data");
}

// Nothing to provision: Mongo creates the collection on first write and _id
// carries an index already. The call survives so the boot sequence still
// reports the storage layer, and so there is an obvious home for an index if
// the prefix listing below ever outgrows an anchored scan.
export async function initFileStore() {
  log.info({ collection: COLLECTION }, "file store ready");
}

// Keys are built from ids only. The student's filename is kept in Mongo,
// never in the key, so odd characters or "../" in a filename can't matter.
export function submissionKey(assignmentId: string, studentId: string) {
  return `${assignmentId}/${studentId}/${randomUUID()}`;
}

export async function putSubmission(key: string, content: Buffer) {
  try {
    await files().insertOne({
      _id: key as unknown as never,
      data: content,
      size: content.length,
      createdAt: new Date(),
    });
  } catch (err) {
    log.error({ err, key }, "write to storage failed");
    throw AppError.dependencyUnavailable("storage");
  }
}

export async function getSubmission(key: string) {
  let doc;
  try {
    doc = await files().findOne({ _id: key as unknown as never });
  } catch (err) {
    log.error({ err, key }, "read from storage failed");
    throw AppError.dependencyUnavailable("storage");
  }
  // A missing file is a 404 and a broken database is a 503. The old client
  // signalled the difference with an error code; here it is just absence.
  if (!doc) throw AppError.notFound("File");
  return toBuffer(doc.data);
}

// Undoes an upload when saving the submission record fails afterwards.
// It never throws: the caller is already handling a more important error.
export async function removeSubmission(key: string) {
  try {
    await files().deleteOne({ _id: key as unknown as never });
  } catch (err) {
    log.error({ err, key }, "could not remove file; it is now an orphan");
  }
}

// Test support. Anchored at the start so the _id index does the work.
export async function listKeys(prefix: string) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = await files()
    .find({ _id: { $regex: `^${escaped}` } as unknown as never }, { projection: { _id: 1 } })
    .toArray();
  return docs.map((d) => String(d._id));
}

// Test support. Drops every stored file, the way emptying the bucket did.
export async function clearAllFiles() {
  await files().deleteMany({});
}
