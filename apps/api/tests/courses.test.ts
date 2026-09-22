import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";
import request from "supertest";

import { bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

type Who = { id: string; token: string };

let app: Express;
let models: Awaited<ReturnType<typeof startTestApp>>["models"];
let sharma: Who, other: Who, admin: Who, s1: Who, s2: Who;
let courseId = "";
let otherCourseId = "";
let assignmentId = "";

const year = "2026-27";
const nextWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const idOf = (doc: any) => doc?._id ?? doc?.id;

beforeAll(async () => {
  ({ app, models } = await startTestApp());
  sharma = await signIn("faculty", "sharma@example.com");
  other = await signIn("faculty", "other@example.com");
  admin = await signIn("admin", "admin@example.com");
  s1 = await signIn("student", "s1@example.com", "BCS2023126");
  s2 = await signIn("student", "s2@example.com", "BCS2023143");
}, 30_000);

afterAll(async () => {
  await stopTestApp();
});

describe("courses", () => {
  it("faculty creates a course; the code is normalised", async () => {
    const res = await request(app).post("/api/courses").set(bearer(sharma.token))
      .send({ code: " cs-501 ", title: "DAA", academicYear: year });
    expect(res.status).toBe(201);
    expect(res.body.course.code).toBe("CS-501");
    courseId = idOf(res.body.course);
  });

  it("refuses the same code in the same year", async () => {
    const res = await request(app).post("/api/courses").set(bearer(sharma.token))
      .send({ code: "CS-501", title: "Again", academicYear: year });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE");
  });

  it("refuses a student", async () => {
    const res = await request(app).post("/api/courses").set(bearer(s1.token))
      .send({ code: "CS-999", title: "Mine", academicYear: year });
    expect(res.status).toBe(403);
  });

  it("makes an admin name the owner", async () => {
    const missing = await request(app).post("/api/courses").set(bearer(admin.token))
      .send({ code: "CS-101", title: "Intro", academicYear: year });
    expect(missing.status).toBe(400);

    const res = await request(app).post("/api/courses").set(bearer(admin.token))
      .send({ code: "CS-101", title: "Intro", academicYear: year, faculty: other.id });
    expect(res.status).toBe(201);
    otherCourseId = idOf(res.body.course);
  });

  it("enrols by roll number and reports the ones it can't find", async () => {
    const res = await request(app).post(`/api/courses/${courseId}/students`).set(bearer(sharma.token))
      .send({ rollNos: ["bcs2023126", "BCS2023143", "BCS2099999"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 2, alreadyEnrolled: 0, notFound: ["BCS2099999"] });
  });

  it("answers another faculty member exactly as for a missing course", async () => {
    const theirs = await request(app).get(`/api/courses/${courseId}`).set(bearer(other.token));
    const missing = await request(app).get("/api/courses/6ab10b2d0f6e0a701e5ab13a").set(bearer(other.token));
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(theirs.body.error.message).toBe(missing.body.error.message);
  });

  it("shows a student the course but not the roster", async () => {
    const res = await request(app).get(`/api/courses/${courseId}`).set(bearer(s1.token));
    expect(res.status).toBe(200);
    expect(res.body.course.enrolledStudents).toBeUndefined();
    expect(res.body.course.studentCount).toBe(2);
  });

  it("lists only the courses a student is enrolled in", async () => {
    const res = await request(app).get("/api/courses").set(bearer(s1.token));
    expect(res.body.total).toBe(1);
  });

  it("hides archived courses unless asked, and freezes their roster", async () => {
    const archive = await request(app).patch(`/api/courses/${otherCourseId}`).set(bearer(other.token))
      .send({ isArchived: true });
    expect(archive.status).toBe(200);

    expect((await request(app).get("/api/courses").set(bearer(other.token))).body.total).toBe(0);
    expect((await request(app).get("/api/courses?archived=true").set(bearer(other.token))).body.total).toBe(1);

    const enrol = await request(app).post(`/api/courses/${otherCourseId}/students`).set(bearer(other.token))
      .send({ rollNos: ["BCS2023126"] });
    expect(enrol.status).toBe(409);
  });

  it("removes students with POST .../students/remove", async () => {
    const res = await request(app).post(`/api/courses/${courseId}/students/remove`).set(bearer(sharma.token))
      .send({ rollNos: ["BCS2023143"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removed: 1, notEnrolled: 0, notFound: [] });
  });
});

describe("assignments", () => {
  it("creates with safe defaults", async () => {
    const res = await request(app).post(`/api/courses/${courseId}/assignments`).set(bearer(sharma.token))
      .send({ title: "Sorting", language: "python", dueAt: nextWeek() });
    expect(res.status).toBe(201);
    expect(res.body.assignment.provenance).toBe("takehome");
    expect(res.body.assignment.maxSubmissions).toBe(3);
    expect(res.body.assignment.isPublished).toBe(false);
    assignmentId = idOf(res.body.assignment);
  });

  it("refuses a deadline without a timezone", async () => {
    const res = await request(app).post(`/api/courses/${courseId}/assignments`).set(bearer(sharma.token))
      .send({ title: "Graphs", language: "python", dueAt: "2026-12-01T23:59:00" });
    expect(res.status).toBe(400);
  });

  it("hides drafts from students", async () => {
    const list = await request(app).get(`/api/courses/${courseId}/assignments`).set(bearer(s1.token));
    expect(list.body.total).toBe(0);
    const open = await request(app).get(`/api/assignments/${assignmentId}`).set(bearer(s1.token));
    expect(open.status).toBe(404);
  });

  it("shows published work with the student's attempt count", async () => {
    const publish = await request(app).patch(`/api/assignments/${assignmentId}`).set(bearer(sharma.token))
      .send({ isPublished: true });
    expect(publish.status).toBe(200);

    expect((await request(app).get(`/api/courses/${courseId}/assignments`).set(bearer(s1.token))).body.total).toBe(1);
    const open = await request(app).get(`/api/assignments/${assignmentId}`).set(bearer(s1.token));
    expect(open.body.assignment.yourAttempts).toBe(0);
  });

  it("freezes language and provenance once a student has submitted", async () => {
    await models.SubmissionModel.create({
      assignment: assignmentId, student: s1.id, attempt: 1, provenance: "takehome", language: "python",
      originalFilename: "sort.py", objectKey: "test/sort.py", sizeBytes: 120, contentHash: "a".repeat(64), lineCount: 10,
    });

    const locked = await request(app).patch(`/api/assignments/${assignmentId}`).set(bearer(sharma.token))
      .send({ provenance: "invigilated" });
    expect(locked.status).toBe(409);
    expect(locked.body.error.message).toContain("provenance");

    // resending the current language is not a change, so it's allowed
    const same = await request(app).patch(`/api/assignments/${assignmentId}`).set(bearer(sharma.token))
      .send({ language: "python", title: "Sorting (v2)" });
    expect(same.status).toBe(200);
  });
});
