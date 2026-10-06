import { createServer, type Server } from "node:http";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_DETECTOR_PORT,
  TEST_DETECTOR_TOKEN,
  bearer,
  signIn,
  startTestApp,
  stopTestApp,
} from "./helpers.js";

type AnalyzeBody = {
  submissionId: string;
  language: string;
  source: string;
  candidates: { submissionId: string; source: string }[];
};

type FeaturesBody = {
  submissionId: string;
  language: string;
  source: string;
};

/**
 * Every source carries a "# f:<n>" marker, and the stub turns that one
 * number into all four scored features. Feature values are therefore exact
 * and chosen by the test rather than guessed at, which is the whole reason
 * Layer 2 can be tested where Layer 1's similarity score could not.
 */
function sourceWith(n: number, lines = 40): string {
  const body = [`# f:${n}`, ""];
  while (body.length < lines) body.push(`value_${body.length} = ${n} + ${body.length}`);
  return body.join("\n") + "\n";
}

function markerIn(source: string): number {
  const found = /# f:(-?[\d.]+)/.exec(source);
  return found ? Number(found[1]) : 0;
}

function defaultFeatures(body: FeaturesBody) {
  const n = markerIn(body.source);
  return {
    detectorVersion: "test-0.0.1",
    featureSetVersion: 1,
    parsed: true,
    lineCount: body.source.split("\n").length,
    features: {
      blank_line_ratio: 0.1 + n * 0.01,
      avg_line_length: 20 + n,
      max_block_depth: 2 + n * 0.1,
      comment_density: 0.05 + n * 0.005,
      // stored on the baseline, not scored. for_loop_ratio is null on
      // purpose: a file with no loops has no loop ratio, and a feature that
      // is null in every anchor must end up absent rather than zero.
      avg_identifier_length: 6 + n * 0.1,
      underscore_identifier_ratio: 0.3,
      function_count: 4,
      for_loop_ratio: null,
      try_block_ratio: 0,
      docstring_ratio: 0,
    },
    durationMs: 1,
  };
}

/** Unrelated by default, so nothing trips the review threshold. */
function defaultAnalyze(body: AnalyzeBody) {
  return {
    detectorVersion: "test-0.0.1",
    parsed: true,
    nodeCount: 42,
    compared: body.candidates.length > 0,
    candidatesCompared: body.candidates.length,
    matches: body.candidates.map((candidate) => ({
      submissionId: candidate.submissionId,
      similarity: 0.1,
      spans: [],
    })),
    durationMs: 1,
  };
}

let analyzeReply: (body: AnalyzeBody) => unknown = defaultAnalyze;
let featuresReply: (body: FeaturesBody) => unknown = defaultFeatures;

let server: Server;
let app: Express;
let models: typeof import("../src/models/index.js");
let runDetection: (typeof import("../src/services/detection.js"))["runDetection"];
let buildBaseline: (typeof import("../src/services/baseline.js"))["buildBaseline"];
let cohortCalibration: (typeof import("../src/services/behavioural.js"))["cohortCalibration"];
let baselineUsability: (typeof import("../src/services/behavioural.js"))["baselineUsability"];
let hasObservedAnchor: (typeof import("../src/services/anchors.js"))["hasObservedAnchor"];
let DetectionResultModel: (typeof import("../src/models/DetectionResult.js"))["DetectionResultModel"];
let DetectionConfigModel: (typeof import("../src/models/DetectionConfig.js"))["DetectionConfigModel"];
let BaselineProfileModel: (typeof import("../src/models/BaselineProfile.js"))["BaselineProfileModel"];
let AuditLogModel: (typeof import("../src/models/AuditLog.js"))["AuditLogModel"];

// unique emails per test, so per-email rate limits never accumulate
let run = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.headers["x-detector-token"] !== TEST_DETECTOR_TOKEN) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: "missing or wrong detector token" }));
      return;
    }
    const isFeatures = req.url === "/features";
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = JSON.parse(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(isFeatures ? featuresReply(body) : analyzeReply(body)));
    });
  });
  await new Promise<void>((resolve) => server.listen(TEST_DETECTOR_PORT, "127.0.0.1", resolve));

  const started = await startTestApp();
  app = started.app;
  models = started.models;

  // imported after startTestApp, so they read the test settings
  ({ runDetection } = await import("../src/services/detection.js"));
  ({ buildBaseline } = await import("../src/services/baseline.js"));
  ({ cohortCalibration, baselineUsability } = await import("../src/services/behavioural.js"));
  ({ hasObservedAnchor } = await import("../src/services/anchors.js"));
  ({ DetectionResultModel } = await import("../src/models/DetectionResult.js"));
  ({ DetectionConfigModel } = await import("../src/models/DetectionConfig.js"));
  ({ BaselineProfileModel } = await import("../src/models/BaselineProfile.js"));
  ({ AuditLogModel } = await import("../src/models/AuditLog.js"));
});

afterAll(async () => {
  await stopTestApp();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  analyzeReply = defaultAnalyze;
  featuresReply = defaultFeatures;
  run += 1;
  await models.clearAllCollections();
});

type Who = { id: string; token: string };

/**
 * courseId arrives as unknown because callers hold a hydrated document's
 * _id, and String() before the write is not decoration: handing unknown to
 * create() leaves no matching overload, the call's type becomes never, and
 * every later property access on the result fails instead.
 */
async function makeAssignment(
  courseId: unknown,
  title: string,
  provenance: "invigilated" | "takehome",
) {
  return models.AssignmentModel.create({
    course: String(courseId),
    title,
    language: "python",
    provenance,
    isPublished: true,
    maxSubmissions: 3,
    dueAt: new Date(Date.now() + 86_400_000),
  });
}

async function enrol(courseId: unknown, studentId: string) {
  await models.CourseModel.updateOne(
    { _id: String(courseId) },
    { $push: { enrolledStudents: studentId } },
  );
}

async function upload(assignmentId: unknown, who: Who, source: string) {
  const res = await request(app)
    .post(`/api/assignments/${assignmentId}/submissions`)
    .set(bearer(who.token))
    .attach("file", Buffer.from(source), "work.py");
  expect(res.status).toBe(201);
  const id = String(res.body.submission.id ?? res.body.submission._id);
  return (await models.SubmissionModel.findById(id))!;
}

const reload = async (id: string) => (await models.SubmissionModel.findById(id))!;

const current = (id: unknown) =>
  DetectionResultModel.findOne({ submission: String(id), isCurrent: true }).lean();

/**
 * runDetection writes the result; it does NOT move the submission's status.
 * The worker owns that transition, so a test calling runDetection directly
 * has to do what the worker would do, or every later check that reads the
 * status sees "queued".
 */
async function analyse(id: string) {
  await runDetection(await reload(id));
  await models.SubmissionModel.updateOne({ _id: id }, { status: "analyzed" });
}

/**
 * Four students, three invigilated assignments each, feature markers chosen
 * so every student has a different mean and a non-zero spread of their own.
 * Without that spread the cohort's pooled standard deviation is zero, every
 * z-score divides by VARIANCE_FLOOR, and the tests pass for the wrong reason.
 */
async function seedCohort(students = 4) {
  const faculty = await signIn("faculty", `l2f${run}@example.com`);
  const people: Who[] = [];
  for (let i = 0; i < students; i += 1) {
    people.push(await signIn("student", `l2s${run}-${i}@example.com`, `BCS2024${run}0${i}`));
  }

  const course = await models.CourseModel.create({
    code: `CS-8${run % 100}`,
    title: "Layer 2",
    academicYear: "2026-27",
    faculty: faculty.id,
    enrolledStudents: people.map((p) => p.id),
  });

  // A saturated behavioural score plus the default 0.5 threshold puts the
  // nominated submission's rps at 0.4857, which would pass by 1.4% and
  // break on any change to the weights. Raising the threshold for this
  // course removes that, and exercises the per-course override that
  // eligibilityFor reads and nothing else tests.
  await DetectionConfigModel.create({
    course: course._id,
    reviewThreshold: 0.9,
    updatedBy: faculty.id,
  });

  const ids: string[] = [];
  for (let a = 0; a < 3; a += 1) {
    const assignment = await makeAssignment(course._id, `Lab ${a}`, "invigilated");
    for (let i = 0; i < people.length; i += 1) {
      // student i sits around marker 10i, and moves a little between labs
      const submission = await upload(assignment._id, people[i]!, sourceWith(10 * i + a, 40 + a));
      ids.push(submission.id);
    }
  }

  // The anchors only need to be analysed, not interestingly analysed: what
  // is under test here is baseline building, so the precondition is set
  // directly rather than paying for twelve detector round trips.
  await models.SubmissionModel.updateMany({ _id: { $in: ids } }, { status: "analyzed" });

  for (const person of people) await buildBaseline(person.id, "python");

  return { faculty, people, course };
}

describe("baseline building", () => {
  it("builds a ready baseline from three invigilated anchors", async () => {
    const { people } = await seedCohort();

    const baseline = await BaselineProfileModel.findOne({
      student: people[0]!.id,
      language: "python",
    });

    expect(baseline?.status).toBe("ready");
    expect(baseline?.anchorCount).toBe(3);
    expect(baseline?.confidence).toBe(1);

    const names = (baseline?.features ?? []).map((f) => f.feature);
    for (const scored of [
      "blank_line_ratio",
      "avg_line_length",
      "max_block_depth",
      "comment_density",
    ]) {
      expect(names).toContain(scored);
    }
    // null in every anchor, so it has no usable samples and is left out
    // rather than stored as a zero
    expect(names).not.toContain("for_loop_ratio");
  });

  it("refuses a baseline with no observed anchor, however many nominations", async () => {
    const { course } = await seedCohort();
    const takehome = await makeAssignment(course._id, "Takehome", "takehome");
    const lonely = await signIn("student", `l2bare${run}@example.com`, `BCS2024${run}99`);
    await enrol(course._id, lonely.id);

    const one = await upload(takehome._id, lonely, sourceWith(5));
    const two = await upload(takehome._id, lonely, sourceWith(6));
    await models.SubmissionModel.updateMany(
      { _id: { $in: [one.id, two.id] } },
      { status: "analyzed", baselineEligible: true },
    );

    const outcome = await buildBaseline(lonely.id, "python");

    expect(outcome.status).toBe("insufficient");
    expect(outcome.reason).toMatch(/judgement rather than an observation/);
    expect(baselineUsability({ status: outcome.status, reason: outcome.reason }).usable).toBe(false);
  });

  it("rebuilds in place and raises the revision rather than making a second row", async () => {
    const { people, course } = await seedCohort();
    const extra = await makeAssignment(course._id, "Lab 3", "invigilated");
    const more = await upload(extra._id, people[0]!, sourceWith(4));
    await models.SubmissionModel.updateOne({ _id: more.id }, { status: "analyzed" });

    const before = await BaselineProfileModel.findOne({ student: people[0]!.id });
    await buildBaseline(people[0]!.id, "python");
    const after = await BaselineProfileModel.findOne({ student: people[0]!.id });

    expect(String(after?._id)).toBe(String(before?._id));
    expect(after?.revision).toBe((before?.revision ?? 0) + 1);
    expect(after?.anchorCount).toBe(4);
    expect(
      await BaselineProfileModel.countDocuments({ student: people[0]!.id, language: "python" }),
    ).toBe(1);
  });
});

describe("the percentile population", () => {
  it("leaves the student out of the variances it would rank them against", async () => {
    const { people, course } = await seedCohort();
    const courseId = String(course._id);

    const everyone = await cohortCalibration(courseId, "python");
    const without = await cohortCalibration(courseId, "python", people[0]!.id);

    expect(everyone.variances).toHaveLength(4);
    expect(without.variances).toHaveLength(3);

    // the spread and the mean still pool the whole cohort: that is the
    // denominator the Day 18 measurement was taken with
    expect(without.baselines).toBe(everyone.baselines);
    expect(without.spread.avg_line_length).toBe(everyone.spread.avg_line_length);
    expect(without.mean.avg_line_length).toBe(everyone.mean.avg_line_length);
  });

  it("ranks a student against their peers only, so their own value cannot pull the percentile", async () => {
    const { people, course } = await seedCohort();
    const mine = await BaselineProfileModel.findOne({ student: people[0]!.id });
    const variance = mine?.intraStudentVariance ?? 0;

    const everyone = await cohortCalibration(String(course._id), "python");
    const without = await cohortCalibration(String(course._id), "python", people[0]!.id);

    // the student's own value is in one population and not the other
    expect(everyone.variances).toContain(variance);
    expect(without.variances).not.toContain(variance);
  });
});

describe("the cohort-controlled change point", () => {
  async function scoreEveryone(courseId: unknown, markers: number[], people: Who[]) {
    const assignment = await makeAssignment(courseId, "Shift", "takehome");
    const submissions = [];
    for (let i = 0; i < people.length; i += 1) {
      submissions.push(await upload(assignment._id, people[i]!, sourceWith(markers[i]!)));
    }
    // first pass: early submissions have too few scored peers. second pass:
    // everyone sees the full cohort, which is what recalibration arranges
    // in production.
    for (const s of submissions) await analyse(s.id);
    for (const s of submissions) await analyse(s.id);
    return submissions;
  }

  it("omits both shifts until three peers have been scored", async () => {
    const { people, course } = await seedCohort();
    const assignment = await makeAssignment(course._id, "Sparse", "takehome");
    const only = await upload(assignment._id, people[0]!, sourceWith(1));

    await analyse(only.id);

    const result = await current(only.id);
    expect(result?.behavioral?.status).toBe("ok");
    expect(result?.behavioral?.studentShift ?? null).toBeNull();
    expect(result?.behavioral?.cohortMeanShift ?? null).toBeNull();
    expect(result?.behavioral?.reason).toMatch(/scored peers/);
  });

  it("records both shifts once the cohort is there", async () => {
    const { people, course } = await seedCohort();
    // everyone moves by about ten, student 0 moves by forty
    const submissions = await scoreEveryone(course._id, [40, 11, 12, 13], people);

    const result = await current(submissions[0]!.id);

    expect(result?.behavioral?.status).toBe("ok");
    expect(typeof result?.behavioral?.studentShift).toBe("number");
    expect(typeof result?.behavioral?.cohortMeanShift).toBe("number");
    expect(result?.behavioral?.reason ?? null).toBeNull();
  });

  it("stores a studentShift that is the root mean square of its own z-scores", async () => {
    const { people, course } = await seedCohort();
    const submissions = await scoreEveryone(course._id, [40, 11, 12, 13], people);

    const result = await current(submissions[0]!.id);
    const zs = (result?.behavioral?.features ?? []).map((f) => f.zScore);
    const implied = Math.sqrt(zs.reduce((total, z) => total + z * z, 0) / zs.length);

    expect(zs).toHaveLength(4);
    expect(result?.behavioral?.studentShift).toBeCloseTo(implied, 9);
  });

  it("leaves a student out of their own cohort, so a peer sees a larger shift", async () => {
    const { people, course } = await seedCohort();
    const submissions = await scoreEveryone(course._id, [40, 11, 12, 13], people);

    const diverging = await current(submissions[0]!.id);
    const conforming = await current(submissions[1]!.id);

    // the peer's cohort contains the diverging student; the diverging
    // student's cohort does not contain themselves. Were the exclusion
    // missing, these two would be equal.
    expect(conforming?.behavioral?.cohortMeanShift).toBeGreaterThan(
      diverging?.behavioral?.cohortMeanShift ?? 0,
    );
  });
});

describe("nomination", () => {
  async function nominatable(courseId: unknown, who: Who, marker = 7) {
    const assignment = await makeAssignment(courseId, `Nominate ${marker}`, "takehome");
    const submission = await upload(assignment._id, who, sourceWith(marker));
    const other = await signIn("student", `l2o${run}-${marker}@example.com`, `BCS2025${run}${marker}`);
    await enrol(courseId, other.id);
    await upload(assignment._id, other, sourceWith(marker + 1));
    // a real result AND an analysed status, because eligibilityFor reads
    // both and only the worker would normally set the second
    await analyse(submission.id);
    return reload(submission.id);
  }

  it("records the nomination, the author, and an audit row", async () => {
    const { faculty, people, course } = await seedCohort();
    const submission = await nominatable(course._id, people[0]!);

    const res = await request(app)
      .post(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send({ reason: "Verified in the lab session, no invigilated slot this term." });

    expect(res.status).toBe(200);
    const after = await reload(submission.id);
    expect(after.baselineEligible).toBe(true);
    expect(String(after.nominatedBy)).toBe(faculty.id);
    expect(after.nominatedAt).toBeInstanceOf(Date);

    const entry = await AuditLogModel.findOne({
      targetId: submission.id,
      action: "baseline.sample_added",
    });
    expect(entry?.actorRole).toBe("faculty");
    expect(entry?.reason).toMatch(/lab session/);
    expect(String(entry?.course)).toBe(String(course._id));
  });

  it("says whether the baseline will actually be usable", async () => {
    const { faculty, people, course } = await seedCohort();
    const anchored = await nominatable(course._id, people[0]!, 7);

    const yes = await request(app)
      .post(`/api/submissions/${anchored.id}/nominate`)
      .set(bearer(faculty.token))
      .send({ reason: "This student already has invigilated work on record." });

    expect(yes.status).toBe(200);
    expect(yes.body.baselineWillBeUsable).toBe(true);
    expect(yes.body.baselineNote ?? null).toBeNull();

    const bare = await signIn("student", `l2nb${run}@example.com`, `BCS2026${run}11`);
    await enrol(course._id, bare.id);
    const bareSubmission = await nominatable(course._id, bare, 8);

    const no = await request(app)
      .post(`/api/submissions/${bareSubmission.id}/nominate`)
      .set(bearer(faculty.token))
      .send({ reason: "No invigilated work exists for this student at all." });

    expect(no.status).toBe(200);
    expect(no.body.baselineWillBeUsable).toBe(false);
    expect(no.body.baselineNote).toMatch(/invigilated/);
    expect(await hasObservedAnchor(bare.id, "python")).toBe(false);
  });

  it("refuses a student, a short reason, and a second nomination", async () => {
    const { faculty, people, course } = await seedCohort();
    const submission = await nominatable(course._id, people[0]!);
    const good = { reason: "Verified in the lab session, no invigilated slot." };

    const asStudent = await request(app)
      .post(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(people[0]!.token))
      .send(good);
    // requireRole answers before the handler, and leaks nothing: every
    // student gets 403 whether or not the id exists
    expect(asStudent.status).toBe(403);

    const tooShort = await request(app)
      .post(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send({ reason: "ok" });
    expect(tooShort.status).toBe(400);

    const first = await request(app)
      .post(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send(good);
    expect(first.status).toBe(200);

    const again = await request(app)
      .post(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send(good);
    expect(again.status).toBe(409);
  });

  it("clears both fields on withdrawal and records who had nominated it", async () => {
    const { faculty, people, course } = await seedCohort();
    const submission = await nominatable(course._id, people[0]!);
    const good = { reason: "Verified in the lab session, no invigilated slot." };

    const made = await request(app)
      .post(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send(good);
    expect(made.status).toBe(200);

    const pulled = await request(app)
      .delete(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send({ reason: "Lab attendance could not be confirmed after all." });

    expect(pulled.status).toBe(200);
    const after = await reload(submission.id);
    expect(after.baselineEligible).toBe(false);
    expect(after.nominatedBy ?? null).toBeNull();
    expect(after.nominatedAt ?? null).toBeNull();

    const entry = await AuditLogModel.findOne({
      targetId: submission.id,
      action: "baseline.sample_removed",
    });
    const before = entry?.changes?.before as { nominatedBy?: string } | undefined;
    expect(before?.nominatedBy).toBe(faculty.id);

    const twice = await request(app)
      .delete(`/api/submissions/${submission.id}/nominate`)
      .set(bearer(faculty.token))
      .send({ reason: "Trying the same withdrawal a second time." });
    expect(twice.status).toBe(409);
  });
});
