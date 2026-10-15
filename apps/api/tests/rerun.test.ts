import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

let app: Express;
let models: typeof import("../src/models/index.js");
let AuditLogModel: (typeof import("../src/models/AuditLog.js"))["AuditLogModel"];

// unique emails per test, so per-email rate limits never accumulate
let run = 0;

const CODE = Buffer.from("def add(a, b):\n    return a + b\n");
const WHY = "the detector was fixed since this was scored";

beforeAll(async () => {
  const started = await startTestApp();
  app = started.app;
  models = started.models;
  ({ AuditLogModel } = await import("../src/models/AuditLog.js"));
});

afterAll(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  run += 1;
  await models.clearAllCollections();
});

/** A course the faculty member owns, an enrolled student, and one submission. */
async function seedSubmission() {
  const owner = await signIn("faculty", `rrf${run}@example.com`);
  const other = await signIn("faculty", `rro${run}@example.com`);
  const student = await signIn("student", `rrs${run}@example.com`, `BCS2028${run}1`);

  const course = await models.CourseModel.create({
    code: `CS-6${run % 100}`,
    title: "Rerun",
    academicYear: "2026-27",
    faculty: owner.id,
    enrolledStudents: [student.id],
  });
  const assignment = await models.AssignmentModel.create({
    course: course._id,
    title: "Lab",
    language: "python",
    isPublished: true,
    maxSubmissions: 3,
    dueAt: new Date(Date.now() + 86_400_000),
  });

  const uploaded = await request(app)
    .post(`/api/assignments/${String(assignment._id)}/submissions`)
    .set(bearer(student.token))
    .attach("file", CODE, "work.py");
  expect(uploaded.status).toBe(201);
  const id = String(uploaded.body.submission.id ?? uploaded.body.submission._id);

  return { owner, other, student, id };
}

/** Puts the submission into a given state, which only the worker normally does. */
async function setStatus(id: string, status: string, failureReason?: string) {
  await models.SubmissionModel.updateOne({ _id: id }, { status, failureReason });
}

const rerun = (id: string, token: string, body: object) =>
  request(app).post(`/api/submissions/${id}/rerun`).set(bearer(token)).send(body);

const reload = async (id: string) => (await models.SubmissionModel.findById(id))!;

describe("re-running detection", () => {
  it("puts an analysed submission back on the queue", async () => {
    const { owner, id } = await seedSubmission();
    await setStatus(id, "analyzed");

    const res = await rerun(id, owner.token, { reason: WHY });

    expect(res.status).toBe(200);
    expect((await reload(id)).status).toBe("queued");
  });

  it("re-runs a failed submission and clears the reason it failed", async () => {
    const { owner, id } = await seedSubmission();
    await setStatus(id, "failed", "the detector was unreachable");

    const res = await rerun(id, owner.token, { reason: WHY });

    expect(res.status).toBe(200);
    const after = await reload(id);
    expect(after.status).toBe("queued");
    // a stale failure message on a submission about to be re-analysed would
    // be read as the outcome of the run that has not happened yet
    expect(after.failureReason).toBeUndefined();
  });

  it("re-runs a submission whose first enqueue was lost", async () => {
    const { owner, id } = await seedSubmission();
    // createSubmission leaves "uploaded" behind exactly when the enqueue
    // failed, so this is the case the endpoint exists for most of all
    await setStatus(id, "uploaded");

    const res = await rerun(id, owner.token, { reason: WHY });

    expect(res.status).toBe(200);
    expect((await reload(id)).status).toBe("queued");
  });

  it("refuses while the worker is mid-analysis", async () => {
    const { owner, id } = await seedSubmission();
    await setStatus(id, "analyzing");

    const res = await rerun(id, owner.token, { reason: WHY });

    // the worker writes "analyzed" when it finishes, which would overwrite
    // the "queued" this would set and strand the new job
    expect(res.status).toBe(409);
    expect((await reload(id)).status).toBe("analyzing");
  });

  it("refuses a student, before the body is parsed", async () => {
    const { student, id } = await seedSubmission();
    await setStatus(id, "analyzed");

    const res = await rerun(id, student.token, { reason: WHY });

    expect(res.status).toBe(403);
    expect((await reload(id)).status).toBe("analyzed");
  });

  it("refuses a faculty member who does not own the course", async () => {
    const { other, id } = await seedSubmission();
    await setStatus(id, "analyzed");

    const res = await rerun(id, other.token, { reason: WHY });

    // 404 rather than 403: this one passed the role guard, so a 403 would
    // confirm the submission exists
    expect(res.status).toBe(404);
  });

  it("requires a reason", async () => {
    const { owner, id } = await seedSubmission();
    await setStatus(id, "analyzed");

    const res = await rerun(id, owner.token, {});

    expect(res.status).toBe(400);
  });

  it("refuses a reason too short to be one", async () => {
    const { owner, id } = await seedSubmission();
    await setStatus(id, "analyzed");

    const res = await rerun(id, owner.token, { reason: "redo" });

    expect(res.status).toBe(400);
  });

  it("records who asked, why, and what the status was before", async () => {
    const { owner, id } = await seedSubmission();
    await setStatus(id, "failed", "the detector was unreachable");

    const res = await rerun(id, owner.token, { reason: WHY });

    expect(res.body.audited).toBe(true);
    const entry = await AuditLogModel.findOne({ action: "detection.rerun_requested" }).lean();
    expect(entry).not.toBeNull();
    expect(String(entry?.actor)).toBe(owner.id);
    expect(entry?.targetType).toBe("Submission");
    expect(entry?.reason).toBe(WHY);
    const changes = entry?.changes as { before?: { status?: string } } | undefined;
    // the superseded state, which is the thing nobody could reconstruct later
    expect(changes?.before?.status).toBe("failed");
  });
});
