import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, pick, signIn, startTestApp, stopTestApp } from "./helpers.js";

let app: Express;
let models: typeof import("../src/models/index.js");
let DetectionResultModel: (typeof import("../src/models/DetectionResult.js"))["DetectionResultModel"];
let AuditLogModel: (typeof import("../src/models/AuditLog.js"))["AuditLogModel"];

// unique emails per test, so per-email rate limits never accumulate
let run = 0;

// The five review states, taken from the model rather than retyped, so this
// file cannot drift from the enum it is asserting against.
type ReviewStatus =
  (typeof import("../src/models/DetectionResult.js"))["REVIEW_STATUS"][number];

beforeAll(async () => {
  const started = await startTestApp();
  app = started.app;
  models = started.models;
  ({ DetectionResultModel } = await import("../src/models/DetectionResult.js"));
  ({ AuditLogModel } = await import("../src/models/AuditLog.js"));
});

afterAll(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  run += 1;
  await models.clearAllCollections();
});

type Who = { id: string; token: string };

/**
 * A faculty member, three enrolled students, a course and a published
 * take-home assignment.
 *
 * Ids are passed around as strings rather than ObjectIds throughout this
 * file. Mongoose casts a 24-character hex string on the way in, and the
 * alternative is threading Types.ObjectId through every fixture helper for no
 * gain in a test that only ever puts these values into a document or a URL.
 *
 * The assignment is created through the API on purpose, because that exercises
 * the validation a real client hits. The course is not, because these tests
 * are about reading results and not about course creation.
 */
async function seedAssignment() {
  const faculty = await signIn("faculty", `resf${run}@example.com`);
  const students: Who[] = [];
  for (let i = 0; i < 3; i += 1) {
    students.push(await signIn("student", `ress${run}-${i}@example.com`, `BCS2026${run}0${i}`));
  }

  const course = await models.CourseModel.create({
    code: `CS-8${run % 100}`,
    title: "Results",
    academicYear: "2026-27",
    faculty: faculty.id,
    enrolledStudents: students.map((s) => s.id),
  });

  const created = await request(app)
    .post(`/api/courses/${String(course._id)}/assignments`)
    .set(bearer(faculty.token))
    .send({
      title: "Lab 1",
      language: "python",
      provenance: "takehome",
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      isPublished: true,
    });
  const assignment = pick(created.body, "assignment");
  if (!assignment) throw new Error(`assignment not created: ${created.status}`);

  return {
    faculty,
    students,
    courseId: String(course._id),
    assignmentId: String(assignment.id ?? assignment._id),
  };
}

/** Returns the new submission's id, which is all any caller here wants. */
async function makeSubmission(
  assignmentId: string,
  studentId: string,
  attempt = 1,
): Promise<string> {
  const submission = await models.SubmissionModel.create({
    assignment: assignmentId,
    student: studentId,
    attempt,
    provenance: "takehome",
    language: "python",
    originalFilename: "main.py",
    objectKey: `test/${studentId}-${attempt}.py`,
    sizeBytes: 100,
    contentHash: "a".repeat(64),
    lineCount: 40,
    status: "analyzed",
  });
  return String(submission._id);
}

/**
 * A result built directly rather than by running detection.
 *
 * These endpoints only read, so putting a detector round trip and a baseline
 * build in front of every test would pay for behaviour that layer2 and
 * detection already cover, and would make a failure here ambiguous between
 * the pipeline and the endpoint.
 */
async function makeResult(opts: {
  submission: string;
  assignmentId: string;
  courseId: string;
  student: string;
  rps: number;
  reviewStatus?: ReviewStatus;
  revision?: number;
  isCurrent?: boolean;
  withEvidence?: boolean;
  otherSubmission?: string;
  otherStudent?: string;
}) {
  return DetectionResultModel.create({
    submission: opts.submission,
    revision: opts.revision ?? 1,
    isCurrent: opts.isCurrent ?? true,
    assignment: opts.assignmentId,
    course: opts.courseId,
    student: opts.student,
    language: "python",
    rps: opts.rps,
    weights: { w1: 0.6, w2: 0.4, w3: 0, effectiveW2: 0.4 },
    configVersion: 1,
    detectorVersion: "test-0.0.1",
    review: { status: opts.reviewStatus ?? "pending" },
    ...(opts.withEvidence
      ? {
          structural: {
            status: "ok" as const,
            score: 0.8,
            matches: [
              {
                otherSubmission: opts.otherSubmission,
                otherStudent: opts.otherStudent,
                similarity: 0.82,
                cohortZScore: 2.4,
                spans: [{ aStart: 1, aEnd: 12, bStart: 3, bEnd: 14 }],
              },
            ],
          },
          behavioral: {
            status: "ok" as const,
            score: 0.6,
            features: [
              {
                feature: "blank_line_ratio",
                value: 0.21,
                baselineMean: 0.1,
                baselineStdDev: 0.0065,
                zScore: 16.9,
              },
            ],
            lowVariance: { flagged: false },
            cohortHealth: {
              flagged: true,
              flooredFeatures: ["max_block_depth"],
              peersScored: 2,
            },
          },
        }
      : {}),
  });
}

describe("the review queue", () => {
  it("ranks an assignment's current results by rps, highest first", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const scores = [0.2, 0.91, 0.55];
    for (let i = 0; i < students.length; i += 1) {
      const submission = await makeSubmission(assignmentId, students[i]!.id);
      await makeResult({
        submission,
        assignmentId,
        courseId,
        student: students[i]!.id,
        rps: scores[i]!,
      });
    }

    const res = await request(app)
      .get(`/api/assignments/${assignmentId}/results`)
      .set(bearer(faculty.token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((r: { rps: number }) => r.rps)).toEqual([0.91, 0.55, 0.2]);
  });

  it("leaves superseded revisions out of the queue", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const submission = await makeSubmission(assignmentId, students[0]!.id);
    await makeResult({
      submission, assignmentId, courseId, student: students[0]!.id,
      rps: 0.9, revision: 1, isCurrent: false,
    });
    await makeResult({
      submission, assignmentId, courseId, student: students[0]!.id,
      rps: 0.3, revision: 2, isCurrent: true,
    });

    const res = await request(app)
      .get(`/api/assignments/${assignmentId}/results`)
      .set(bearer(faculty.token));

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].rps).toBe(0.3);
  });

  it("returns summary rows, without the two bulky evidence arrays", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const a = await makeSubmission(assignmentId, students[0]!.id);
    const b = await makeSubmission(assignmentId, students[1]!.id);
    await makeResult({
      submission: a, assignmentId, courseId, student: students[0]!.id,
      rps: 0.9, withEvidence: true, otherSubmission: b, otherStudent: students[1]!.id,
    });

    const res = await request(app)
      .get(`/api/assignments/${assignmentId}/results`)
      .set(bearer(faculty.token));

    const row = res.body.items[0];
    // the score and the flags survive, because a queue row is judged on them
    expect(row.rps).toBe(0.9);
    expect(row.behavioral.cohortHealth.flagged).toBe(true);
    expect(row.structural.matches).toHaveLength(1);
    // the heavy detail does not
    expect(row.behavioral.features ?? []).toEqual([]);
    expect(row.structural.matches[0].spans ?? []).toEqual([]);
  });

  it("filters by review status and by a minimum rps", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const rows: { rps: number; reviewStatus: ReviewStatus }[] = [
      { rps: 0.95, reviewStatus: "pending" },
      { rps: 0.44, reviewStatus: "pending" },
      { rps: 0.88, reviewStatus: "dismissed" },
    ];
    for (let i = 0; i < rows.length; i += 1) {
      const submission = await makeSubmission(assignmentId, students[i]!.id);
      await makeResult({
        submission, assignmentId, courseId, student: students[i]!.id, ...rows[i]!,
      });
    }

    const pending = await request(app)
      .get(`/api/assignments/${assignmentId}/results?reviewStatus=pending`)
      .set(bearer(faculty.token));
    expect(pending.body.total).toBe(2);

    const high = await request(app)
      .get(`/api/assignments/${assignmentId}/results?minRps=0.5`)
      .set(bearer(faculty.token));
    expect(high.body.total).toBe(2);

    const both = await request(app)
      .get(`/api/assignments/${assignmentId}/results?reviewStatus=pending&minRps=0.5`)
      .set(bearer(faculty.token));
    expect(both.body.total).toBe(1);
    expect(both.body.items[0].rps).toBe(0.95);
  });

  it("gives a student a 404 rather than a 403, so ids cannot be probed", async () => {
    const { students, courseId, assignmentId } = await seedAssignment();
    const submission = await makeSubmission(assignmentId, students[0]!.id);
    await makeResult({
      submission, assignmentId, courseId, student: students[0]!.id, rps: 0.9,
    });

    const res = await request(app)
      .get(`/api/assignments/${assignmentId}/results`)
      .set(bearer(students[0]!.token));

    expect(res.status).toBe(404);
  });

  it("hides another faculty member's assignment", async () => {
    const { assignmentId } = await seedAssignment();
    const outsider = await signIn("faculty", `resx${run}@example.com`);

    const res = await request(app)
      .get(`/api/assignments/${assignmentId}/results`)
      .set(bearer(outsider.token));

    expect(res.status).toBe(404);
  });
});

describe("the evidence behind one score", () => {
  it("returns the weights, the matches with their spans, and the deviations", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const a = await makeSubmission(assignmentId, students[0]!.id);
    const b = await makeSubmission(assignmentId, students[1]!.id);
    await makeResult({
      submission: a, assignmentId, courseId, student: students[0]!.id,
      rps: 0.74, withEvidence: true, otherSubmission: b, otherStudent: students[1]!.id,
    });

    const res = await request(app)
      .get(`/api/submissions/${a}/result`)
      .set(bearer(faculty.token));

    expect(res.status).toBe(200);
    const result = res.body.result;
    // exactly what produced the number, which is the point of the endpoint
    expect(result.rps).toBe(0.74);
    expect(result.weights).toMatchObject({ w1: 0.6, w2: 0.4, effectiveW2: 0.4 });
    expect(result.configVersion).toBe(1);
    expect(result.structural.matches[0].spans).toHaveLength(1);
    expect(result.behavioral.features[0].feature).toBe("blank_line_ratio");
    expect(result.behavioral.features[0].baselineStdDev).toBe(0.0065);
    // and the flag that says the layer is not discriminating
    expect(result.behavioral.cohortHealth.flooredFeatures).toEqual(["max_block_depth"]);
  });

  it("names who the structural match was against", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const a = await makeSubmission(assignmentId, students[0]!.id);
    const b = await makeSubmission(assignmentId, students[1]!.id);
    await makeResult({
      submission: a, assignmentId, courseId, student: students[0]!.id,
      rps: 0.9, withEvidence: true, otherSubmission: b, otherStudent: students[1]!.id,
    });

    const res = await request(app)
      .get(`/api/submissions/${a}/result`)
      .set(bearer(faculty.token));

    expect(res.body.result.structural.matches[0].otherStudent).toMatchObject({
      rollNo: `BCS2026${run}01`,
    });
  });

  it("reports which revisions exist and can fetch an earlier one", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const submission = await makeSubmission(assignmentId, students[0]!.id);
    await makeResult({
      submission, assignmentId, courseId, student: students[0]!.id,
      rps: 0.9, revision: 1, isCurrent: false,
    });
    await makeResult({
      submission, assignmentId, courseId, student: students[0]!.id,
      rps: 0.3, revision: 2, isCurrent: true,
    });

    const latest = await request(app)
      .get(`/api/submissions/${submission}/result`)
      .set(bearer(faculty.token));
    expect(latest.body.result.revision).toBe(2);
    expect(latest.body.result.rps).toBe(0.3);
    expect(latest.body.revisions).toEqual([1, 2]);

    const earlier = await request(app)
      .get(`/api/submissions/${submission}/result?revision=1`)
      .set(bearer(faculty.token));
    expect(earlier.body.result.revision).toBe(1);
    expect(earlier.body.result.rps).toBe(0.9);
  });

  it("404s a submission that has not been analysed, and a revision that does not exist", async () => {
    const { faculty, students, courseId, assignmentId } = await seedAssignment();
    const bare = await makeSubmission(assignmentId, students[0]!.id);
    const scored = await makeSubmission(assignmentId, students[1]!.id);
    await makeResult({
      submission: scored, assignmentId, courseId, student: students[1]!.id, rps: 0.5,
    });

    const none = await request(app)
      .get(`/api/submissions/${bare}/result`)
      .set(bearer(faculty.token));
    expect(none.status).toBe(404);

    const missing = await request(app)
      .get(`/api/submissions/${scored}/result?revision=7`)
      .set(bearer(faculty.token));
    expect(missing.status).toBe(404);
  });

  it("gives a student a 404 for their own result", async () => {
    const { students, courseId, assignmentId } = await seedAssignment();
    const submission = await makeSubmission(assignmentId, students[0]!.id);
    await makeResult({
      submission, assignmentId, courseId, student: students[0]!.id, rps: 0.9,
    });

    // deliberate: a student who can read their own z-scores can tune a
    // submission against them. The student-facing view is a narrower endpoint
    // that shows status and the reviewer's note, and does not exist yet.
    const res = await request(app)
      .get(`/api/submissions/${submission}/result`)
      .set(bearer(students[0]!.token));

    expect(res.status).toBe(404);
  });
});

describe("recording a decision", () => {
  const decide = (token: string, submission: string, status: string, note: string) =>
    request(app)
      .patch(`/api/submissions/${submission}/review`)
      .set(bearer(token))
      .send({ status, note });

  async function oneResult() {
    const seeded = await seedAssignment();
    const submission = await makeSubmission(seeded.assignmentId, seeded.students[0]!.id);
    await makeResult({
      submission,
      assignmentId: seeded.assignmentId,
      courseId: seeded.courseId,
      student: seeded.students[0]!.id,
      rps: 0.81,
    });
    return { ...seeded, submission };
  }

  it("records the decision, who made it, and when", async () => {
    const { faculty, submission } = await oneResult();

    const res = await decide(faculty.token, submission, "dismissed", "Same template as the lab notes");

    expect(res.status).toBe(200);
    expect(res.body.result.review.status).toBe("dismissed");
    expect(res.body.result.review.note).toBe("Same template as the lab notes");
    expect(res.body.result.review.reviewedBy).toBe(faculty.id);
    expect(res.body.result.review.reviewedAt).toBeTruthy();
  });

  it("writes an audit entry naming the action, the actor's role and the transition", async () => {
    const { faculty, submission } = await oneResult();

    const res = await decide(faculty.token, submission, "escalated", "Referred to the committee");
    expect(res.body.audited).toBe(true);

    const entries = await AuditLogModel.find({ targetType: "DetectionResult" });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.action).toBe("result.escalated");
    expect(entries[0]!.actorRole).toBe("faculty");
    expect(entries[0]!.reason).toBe("Referred to the committee");
    expect(entries[0]!.changes?.before).toMatchObject({ status: "pending" });
    expect(entries[0]!.changes?.after).toMatchObject({ status: "escalated" });
  });

  it("allows one decision to follow another, and audits both", async () => {
    const { faculty, submission } = await oneResult();

    await decide(faculty.token, submission, "contested", "The student disputes this");
    const second = await decide(faculty.token, submission, "escalated", "Dispute went to committee");

    expect(second.status).toBe(200);
    expect(second.body.result.review.status).toBe("escalated");

    const actions = (await AuditLogModel.find({ targetType: "DetectionResult" }).sort({ at: 1 }))
      .map((e) => e.action);
    expect(actions).toEqual(["result.contested", "result.escalated"]);
  });

  it("refuses a decision that changes nothing", async () => {
    const { faculty, submission } = await oneResult();
    await decide(faculty.token, submission, "dismissed", "Nothing to answer for here");

    const again = await decide(faculty.token, submission, "dismissed", "Still nothing to answer");

    expect(again.status).toBe(409);
    // the refused call must not have written a second entry
    expect(await AuditLogModel.countDocuments({ targetType: "DetectionResult" })).toBe(1);
  });

  it("refuses reopening to pending, which has no audit action", async () => {
    const { faculty, submission } = await oneResult();
    await decide(faculty.token, submission, "dismissed", "Looked at it and it is fine");

    const reopen = await decide(faculty.token, submission, "pending", "Changed my mind about this");

    expect(reopen.status).toBe(400);
  });

  it("requires a note of real length", async () => {
    const { faculty, submission } = await oneResult();

    expect((await decide(faculty.token, submission, "dismissed", "ok")).status).toBe(400);
    expect((await decide(faculty.token, submission, "dismissed", ".")).status).toBe(400);
  });

  it("does not destroy a student's explanation", async () => {
    const { faculty, submission } = await oneResult();
    await DetectionResultModel.updateOne(
      { submission, isCurrent: true },
      { $set: { "review.studentExplanation": "I wrote this in the lab, see my commits" } },
    );

    await decide(faculty.token, submission, "confirmed_clean", "Commit history supports this");

    const after = await DetectionResultModel.findOne({ submission, isCurrent: true });
    expect(after?.review?.studentExplanation).toBe("I wrote this in the lab, see my commits");
    expect(after?.review?.status).toBe("confirmed_clean");
  });

  it("refuses a student and an unrelated faculty member", async () => {
    const { students, submission } = await oneResult();
    const outsider = await signIn("faculty", `resy${run}@example.com`);

    expect((await decide(students[0]!.token, submission, "dismissed", "Please drop this one")).status)
      .toBe(403);
    expect((await decide(outsider.token, submission, "dismissed", "Not my course at all")).status)
      .toBe(404);
    expect(await AuditLogModel.countDocuments({ targetType: "DetectionResult" })).toBe(0);
  });

  it("is visible to the queue's review filter afterwards", async () => {
    const { faculty, submission, assignmentId } = await oneResult();
    await decide(faculty.token, submission, "dismissed", "Matches the worked example");

    const pending = await request(app)
      .get(`/api/assignments/${assignmentId}/results?reviewStatus=pending`)
      .set(bearer(faculty.token));
    expect(pending.body.total).toBe(0);

    const dismissed = await request(app)
      .get(`/api/assignments/${assignmentId}/results?reviewStatus=dismissed`)
      .set(bearer(faculty.token));
    expect(dismissed.body.total).toBe(1);
  });
});
