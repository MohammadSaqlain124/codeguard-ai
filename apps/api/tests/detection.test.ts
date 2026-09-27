import { createServer, type Server } from "node:http";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_DETECTOR_PORT, bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

type AnalyzeBody = {
  submissionId: string;
  language: string;
  source: string;
  candidates: { submissionId: string; source: string }[];
};

const ORIGINAL = "def add(a, b):\n    total = a + b\n    return total\n";
const OTHER = "def connect(host):\n    sock = open_socket(host)\n    return sock\n";

/**
 * The tests drive the Node side, so the detector is a stub we control.
 * Identical sources score 1 with a span, anything else scores 0.5. The
 * detector's own behaviour is verified on the Python side.
 */
function defaultReply(body: AnalyzeBody) {
  const matches = body.candidates.map((candidate) => {
    const identical = candidate.source === body.source;
    return {
      submissionId: candidate.submissionId,
      similarity: identical ? 1 : 0.5,
      spans: identical ? [{ aStart: 1, aEnd: 3, bStart: 1, bEnd: 3 }] : [],
    };
  });
  return {
    detectorVersion: "test-0.0.1",
    parsed: true,
    nodeCount: 42,
    compared: body.candidates.length > 0,
    candidatesCompared: matches.length,
    matches,
    durationMs: 1,
  };
}

let reply: (body: AnalyzeBody) => unknown = defaultReply;
let lastBody: AnalyzeBody | undefined;

let server: Server;
let app: Express;
let models: typeof import("../src/models/index.js");
let runDetection: (typeof import("../src/services/detection.js"))["runDetection"];
let recalibrateAssignment: (typeof import("../src/services/recalibrate.js"))["recalibrateAssignment"];
let DetectionResultModel: (typeof import("../src/models/DetectionResult.js"))["DetectionResultModel"];

// unique emails per test, so per-email rate limits never accumulate
let run = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      lastBody = JSON.parse(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply(lastBody!)));
    });
  });
  await new Promise<void>((resolve) => server.listen(TEST_DETECTOR_PORT, "127.0.0.1", resolve));

  const started = await startTestApp();
  app = started.app;
  models = started.models;

  // imported after startTestApp, so they read the test settings
  ({ runDetection } = await import("../src/services/detection.js"));
  ({ recalibrateAssignment } = await import("../src/services/recalibrate.js"));
  ({ DetectionResultModel } = await import("../src/models/DetectionResult.js"));
});

afterAll(async () => {
  await stopTestApp();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  reply = defaultReply;
  lastBody = undefined;
  run += 1;
  await models.clearAllCollections();
});

async function seed() {
  const faculty = await signIn("faculty", `f${run}@example.com`);
  const students = [];
  for (let i = 1; i <= 3; i += 1) {
    students.push(await signIn("student", `s${run}-${i}@example.com`, `BCS2023${run}0${i}`));
  }
  const course = await models.CourseModel.create({
    code: `CS-70${run % 10}`,
    title: "Detection",
    academicYear: "2026-27",
    faculty: faculty.id,
    enrolledStudents: students.map((s) => s.id),
  });
  const assignment = await models.AssignmentModel.create({
    course: course._id,
    title: "Work",
    language: "python",
    isPublished: true,
    maxSubmissions: 3,
    dueAt: new Date(Date.now() + 86_400_000),
  });
  return { assignment, students };
}

async function upload(assignmentId: unknown, who: { token: string }, source: string) {
  const res = await request(app)
    .post(`/api/assignments/${assignmentId}/submissions`)
    .set(bearer(who.token))
    .attach("file", Buffer.from(source), "work.py");
  expect(res.status).toBe(201);
  const id = String(res.body.submission.id ?? res.body.submission._id);
  return (await models.SubmissionModel.findById(id))!;
}

// String() because mongoose casts a string to an ObjectId at query time,
// while its filter types will not take an unknown
const reload = async (id: unknown) => (await models.SubmissionModel.findById(String(id)))!;
const current = (id: unknown) =>
  DetectionResultModel.findOne({ submission: String(id), isCurrent: true }).lean();

describe("detection", () => {
  it("skips the layer when there is nobody to compare against", async () => {
    const { assignment, students } = await seed();
    const only = await upload(assignment._id, students[0], ORIGINAL);

    const outcome = await runDetection(only);

    expect(outcome.structuralStatus).toBe("skipped");
    expect(outcome.rps).toBe(0);
    const result = await current(only._id);
    expect(result?.structural?.reason).toMatch(/No other submissions/);
  });

  it("scores a copy at one and keeps its spans", async () => {
    const { assignment, students } = await seed();
    const first = await upload(assignment._id, students[0], ORIGINAL);
    await runDetection(first);
    const second = await upload(assignment._id, students[1], ORIGINAL);

    const outcome = await runDetection(second);

    expect(outcome.rps).toBe(1);
    expect(outcome.structuralStatus).toBe("ok");
    const result = await current(second._id);
    expect(result?.structural?.matches).toHaveLength(1);
    expect(result?.structural?.matches?.[0]?.spans).toHaveLength(1);
    expect(String(result?.structural?.matches?.[0]?.otherSubmission)).toBe(String(first._id));
  });

  it("records an exact duplicate from the hash, not from the score", async () => {
    const { assignment, students } = await seed();
    const first = await upload(assignment._id, students[0], ORIGINAL);
    const second = await upload(assignment._id, students[1], ORIGINAL);

    // the detector says these are unrelated; the hashes say otherwise
    reply = () => ({
      detectorVersion: "test-0.0.1",
      parsed: true,
      compared: true,
      candidatesCompared: 1,
      matches: [{ submissionId: String(first._id), similarity: 0.2, spans: [] }],
      durationMs: 1,
    });

    await runDetection(second);

    const result = await current(second._id);
    expect(String(result?.structural?.exactDuplicateOf)).toBe(String(first._id));
  });

  it("offers only each student's latest attempt as a candidate", async () => {
    const { assignment, students } = await seed();
    await upload(assignment._id, students[0], ORIGINAL);
    const newer = await upload(assignment._id, students[0], OTHER);
    const other = await upload(assignment._id, students[1], ORIGINAL);

    await runDetection(other);

    expect(lastBody?.candidates).toHaveLength(1);
    expect(lastBody?.candidates[0]?.submissionId).toBe(String(newer._id));
  });

  it("records a failed layer when the source will not parse", async () => {
    const { assignment, students } = await seed();
    const submission = await upload(assignment._id, students[0], "def broken(:\n");
    reply = () => ({
      detectorVersion: "test-0.0.1",
      parsed: false,
      parseError: "Source does not parse cleanly near line 1",
      compared: false,
      candidatesCompared: 0,
      matches: [],
      durationMs: 1,
    });

    const outcome = await runDetection(submission);

    expect(outcome.structuralStatus).toBe("failed");
    expect(outcome.rps).toBe(0);
    const result = await current(submission._id);
    expect(result?.structural?.reason).toMatch(/does not parse/);
  });
});

describe("recalibration", () => {
  it("re-analyses a result computed before a later submission arrived", async () => {
    const { assignment, students } = await seed();
    const first = await upload(assignment._id, students[0], ORIGINAL);
    await runDetection(first);
    expect((await current(first._id))?.structural?.status).toBe("skipped");

    await upload(assignment._id, students[1], ORIGINAL);

    const round = await recalibrateAssignment(String(assignment._id));
    expect(round.reanalysed).toBe(1);
    // the worker would pick that job up; here we run it directly
    await runDetection(await reload(first._id));

    const result = await current(first._id);
    expect(result?.revision).toBe(2);
    expect(result?.structural?.status).toBe("ok");
    // the superseded revision is kept, but only one is current
    expect(await DetectionResultModel.countDocuments({ submission: String(first._id) })).toBe(2);
    expect(
      await DetectionResultModel.countDocuments({
        submission: String(first._id),
        isCurrent: true,
      }),
    ).toBe(1);
  });

  it("writes cohort z-scores, and settles", async () => {
    const { assignment, students } = await seed();
    const a = await upload(assignment._id, students[0], ORIGINAL);
    const b = await upload(assignment._id, students[1], ORIGINAL);
    const c = await upload(assignment._id, students[2], OTHER);

    // first pass sees partial cohorts, second sees all of them
    for (const s of [a, b, c]) await runDetection(await reload(s._id));
    for (const s of [a, b, c]) await runDetection(await reload(s._id));

    const stats = await recalibrateAssignment(String(assignment._id));

    expect(stats.reanalysed).toBe(0);
    // three results, two matches each
    expect(stats.samples).toBe(6);
    // {1, 0.5, 1, 0.5, 0.5, 0.5}
    expect(stats.mean).toBeCloseTo(0.6667, 4);
    expect(stats.stdDev).toBeCloseTo(0.2582, 4);

    const result = await current(a._id);
    const strong = result?.structural?.matches?.find((m) => m.similarity === 1);
    const weak = result?.structural?.matches?.find((m) => m.similarity === 0.5);
    expect(strong?.cohortZScore).toBeCloseTo(1.291, 3);
    expect(weak?.cohortZScore).toBeCloseTo(-0.6455, 3);
    expect(result?.structural?.cohortSampleSize).toBe(6);

    // running it again finds nothing stale and changes nothing
    const again = await recalibrateAssignment(String(assignment._id));
    expect(again.reanalysed).toBe(0);
    expect(again.samples).toBe(6);
  });
});
