import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

let app: Express;
let models: typeof import("../src/models/index.js");
let AuditLogModel: (typeof import("../src/models/AuditLog.js"))["AuditLogModel"];

// unique emails per test, so per-email rate limits never accumulate
let run = 0;

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

/** A course, its owner, a second faculty member who does not own it, and a student. */
async function seedCourse() {
  const owner = await signIn("faculty", `cfgf${run}@example.com`);
  const other = await signIn("faculty", `cfgo${run}@example.com`);
  const admin = await signIn("admin", `cfga${run}@example.com`);
  const student = await signIn("student", `cfgs${run}@example.com`, `BCS2027${run}1`);

  const course = await models.CourseModel.create({
    code: `CS-9${run % 100}`,
    title: "Config",
    academicYear: "2026-27",
    faculty: owner.id,
    enrolledStudents: [student.id],
  });

  return { course, courseId: String(course._id), owner, other, admin, student };
}

const read = (app: Express, courseId: string, token: string) =>
  request(app).get(`/api/courses/${courseId}/config`).set(bearer(token));

const write = (app: Express, courseId: string, token: string, body: object) =>
  request(app).patch(`/api/courses/${courseId}/config`).set(bearer(token)).send(body);

describe("reading the detection config", () => {
  it("reports the defaults, and says they are the defaults", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await read(app, courseId, owner.token);

    expect(res.status).toBe(200);
    expect(res.body.config.w1).toBe(0.4);
    expect(res.body.config.reviewThreshold).toBe(0.5);
    expect(res.body.config.overrides).toEqual([]);
    expect(res.body.config.isDefault).toBe(true);
    // 0, so a result stamped with it cannot be confused with a saved config
    expect(res.body.config.version).toBe(0);
  });

  it("hides the config from the enrolled student", async () => {
    const { courseId, student } = await seedCourse();

    const res = await read(app, courseId, student.token);

    // 403 from the role guard, which runs before the course is ever loaded.
    // Telling a student they are not staff leaks nothing: it is true of every
    // course, so it cannot be used to find out which ones exist.
    expect(res.status).toBe(403);
  });

  it("hides the config from a faculty member who does not own the course", async () => {
    const { courseId, other } = await seedCourse();

    const res = await read(app, courseId, other.token);

    // 404 and not 403, unlike the student above. This one passed the role
    // guard, so the answer now depends on a specific course, and a 403 here
    // would confirm that course exists.
    expect(res.status).toBe(404);
  });

  it("lets an admin read any course's config", async () => {
    const { courseId, admin } = await seedCourse();

    const res = await read(app, courseId, admin.token);

    expect(res.status).toBe(200);
  });
});

describe("writing the detection config", () => {
  it("creates the row on the first write and starts the version at one", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, { reviewThreshold: 0.65 });

    expect(res.status).toBe(200);
    expect(res.body.config.reviewThreshold).toBe(0.65);
    expect(res.body.config.version).toBe(1);
    expect(res.body.config.isDefault).toBe(false);
    // untouched fields keep the defaults rather than being cleared
    expect(res.body.config.w1).toBe(0.4);
    expect(res.body.config.minAnchorsForBaseline).toBe(3);
  });

  it("bumps the version on every write", async () => {
    const { courseId, owner } = await seedCourse();
    await write(app, courseId, owner.token, { reviewThreshold: 0.6 });

    const res = await write(app, courseId, owner.token, { reviewThreshold: 0.7 });

    expect(res.body.config.version).toBe(2);
    expect(res.body.config.reviewThreshold).toBe(0.7);
  });

  it("leaves the fields a patch did not mention", async () => {
    const { courseId, owner } = await seedCourse();
    await write(app, courseId, owner.token, { minBaselineConfidence: 0.55 });

    const res = await write(app, courseId, owner.token, { reviewThreshold: 0.7 });

    expect(res.body.config.minBaselineConfidence).toBe(0.55);
  });

  it("stores a per-language override and gives it back on the read", async () => {
    const { courseId, owner } = await seedCourse();

    await write(app, courseId, owner.token, {
      overrides: [{ language: "java", reviewThreshold: 0.65 }],
    });
    const res = await read(app, courseId, owner.token);

    expect(res.body.config.overrides).toHaveLength(1);
    expect(res.body.config.overrides[0].language).toBe("java");
    expect(res.body.config.overrides[0].reviewThreshold).toBe(0.65);
  });

  it("replaces the override list wholesale, and an empty array clears it", async () => {
    const { courseId, owner } = await seedCourse();
    await write(app, courseId, owner.token, {
      overrides: [{ language: "java", reviewThreshold: 0.65 }],
    });

    const res = await write(app, courseId, owner.token, { overrides: [] });

    expect(res.body.config.overrides).toEqual([]);
  });

  it("keeps the overrides when the patch does not mention them", async () => {
    const { courseId, owner } = await seedCourse();
    await write(app, courseId, owner.token, {
      overrides: [{ language: "java", reviewThreshold: 0.65 }],
    });

    const res = await write(app, courseId, owner.token, { reviewThreshold: 0.55 });

    expect(res.body.config.overrides).toHaveLength(1);
  });

  it("refuses a partial weight triple with a field name", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, { w1: 0.5 });

    // 400 from the schema rather than 500 from mongoose, which is the whole
    // reason the rule is stated in both places
    expect(res.status).toBe(400);
  });

  it("refuses a weight triple that does not sum to one", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, { w1: 0.5, w2: 0.5, w3: 0.5 });

    expect(res.status).toBe(400);
  });

  it("accepts a weight triple that does sum to one", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, { w1: 0.2, w2: 0.5, w3: 0.3 });

    expect(res.status).toBe(200);
    expect([res.body.config.w1, res.body.config.w2, res.body.config.w3]).toEqual([0.2, 0.5, 0.3]);
  });

  it("refuses two overrides for the same language", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, {
      overrides: [
        { language: "java", reviewThreshold: 0.6 },
        { language: "java", reviewThreshold: 0.7 },
      ],
    });

    expect(res.status).toBe(400);
  });

  it("refuses an unknown language", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, {
      overrides: [{ language: "rust", reviewThreshold: 0.6 }],
    });

    expect(res.status).toBe(400);
  });

  it("refuses an empty body", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, {});

    expect(res.status).toBe(400);
  });

  it("refuses a field that is not a setting", async () => {
    const { courseId, owner } = await seedCourse();

    // .strict() on the schema: a typo must not be silently dropped
    const res = await write(app, courseId, owner.token, { reviewThreshhold: 0.6 });

    expect(res.status).toBe(400);
  });

  it("refuses a write from a faculty member who does not own the course", async () => {
    const { courseId, other } = await seedCourse();

    const res = await write(app, courseId, other.token, { reviewThreshold: 0.65 });

    expect(res.status).toBe(404);
  });

  it("refuses a write from the enrolled student", async () => {
    const { courseId, student } = await seedCourse();

    const res = await write(app, courseId, student.token, { reviewThreshold: 0.65 });

    // the role guard runs before the body is parsed, so this never reaches
    // validation and never touches the database
    expect(res.status).toBe(403);
  });

  it("records who changed it, and what it was before", async () => {
    const { courseId, owner } = await seedCourse();

    const res = await write(app, courseId, owner.token, { reviewThreshold: 0.65 });

    expect(res.body.audited).toBe(true);
    const entry = await AuditLogModel.findOne({ action: "config.weights_updated" }).lean();
    expect(entry).not.toBeNull();
    expect(String(entry?.actor)).toBe(owner.id);
    expect(entry?.actorRole).toBe("faculty");
    expect(entry?.targetType).toBe("DetectionConfig");
    // the before/after pair is what makes this an audit rather than a log line
    const changes = entry?.changes as { before?: { reviewThreshold?: number } } | undefined;
    expect(changes?.before?.reviewThreshold).toBe(0.5);
  });
});

describe("the config a write produces is the one detection reads", () => {
  it("hands configFor the override the endpoint stored", async () => {
    const { courseId, owner } = await seedCourse();
    await write(app, courseId, owner.token, {
      overrides: [{ language: "java", w1: 0.2, w2: 0.5, w3: 0.3 }],
    });

    // the endpoint and the resolver are separate code paths over one row, so
    // this is the join that proves the write is readable by the thing that
    // actually scores a submission
    const { configFor } = await import("../src/services/detectionConfig.js");
    const java = await configFor(courseId, "java");
    const python = await configFor(courseId, "python");

    expect([java.w1, java.w2, java.w3]).toEqual([0.2, 0.5, 0.3]);
    expect(java.version).toBe(1);
    expect(python.w1).toBe(0.4);
  });
});
