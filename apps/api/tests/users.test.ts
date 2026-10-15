import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

let app: Express;
let models: typeof import("../src/models/index.js");
let AuditLogModel: (typeof import("../src/models/AuditLog.js"))["AuditLogModel"];

// unique emails per test, so per-email rate limits never accumulate
let run = 0;

const WHY = "left the university at the end of September";

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

async function seedPeople() {
  const admin = await signIn("admin", `uua${run}@example.com`);
  const faculty = await signIn("faculty", `uuf${run}@example.com`);
  const student = await signIn("student", `uus${run}@example.com`, `BCS2029${run}1`);
  return { admin, faculty, student };
}

const patch = (id: string, token: string, body: object) =>
  request(app).patch(`/api/auth/users/${id}`).set(bearer(token)).send(body);

const reload = async (id: string) => (await models.UserModel.findById(id))!;

describe("disabling an account", () => {
  it("turns it off, and the audit says who and why", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, { isActive: false, reason: WHY });

    expect(res.status).toBe(200);
    expect((await reload(faculty.id)).isActive).toBe(false);
    expect(res.body.audited).toEqual(["user.deactivated"]);
    const entry = await AuditLogModel.findOne({ action: "user.deactivated" }).lean();
    expect(String(entry?.actor)).toBe(admin.id);
    expect(entry?.reason).toBe(WHY);
  });

  it("stops the disabled account from working on the very next request", async () => {
    const { admin, faculty } = await seedPeople();
    await patch(faculty.id, admin.token, { isActive: false, reason: WHY });

    // their access token is still inside its fifteen minutes, but
    // requireActiveUser re-reads the account on every write
    const after = await request(app)
      .post("/api/courses")
      .set(bearer(faculty.token))
      .send({ code: "CS-999", title: "Anything", academicYear: "2026-27" });

    expect([401, 403]).toContain(after.status);
  });

  it("records a reactivation as its own action, not as a deactivation", async () => {
    const { admin, faculty } = await seedPeople();
    await patch(faculty.id, admin.token, { isActive: false, reason: WHY });

    const res = await patch(faculty.id, admin.token, {
      isActive: true,
      reason: "came back from leave in October",
    });

    expect(res.body.audited).toEqual(["user.reactivated"]);
    expect((await reload(faculty.id)).isActive).toBe(true);
  });
});

describe("changing a role", () => {
  it("promotes a student and takes their roll number with it", async () => {
    const { admin, student } = await seedPeople();

    const res = await patch(student.id, admin.token, { role: "faculty", reason: WHY });

    expect(res.status).toBe(200);
    const after = await reload(student.id);
    expect(after.role).toBe("faculty");
    // a faculty member holding a roll number breaks the invariant
    // createUserSchema states, and there is nothing an admin could supply
    expect(after.rollNo).toBeUndefined();
    expect(res.body.audited).toEqual(["user.role_changed"]);
  });

  it("refuses to make somebody a student without a roll number", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, { role: "student", reason: WHY });

    expect(res.status).toBe(400);
    expect((await reload(faculty.id)).role).toBe("faculty");
  });

  it("accepts a demotion that supplies one", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, {
      role: "student",
      rollNo: `BCS2030${run}7`,
      reason: WHY,
    });

    expect(res.status).toBe(200);
    const after = await reload(faculty.id);
    expect(after.role).toBe("student");
    expect(after.rollNo).toBeTruthy();
  });

  it("writes two entries when a role and a status both change", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, {
      role: "admin",
      isActive: false,
      reason: WHY,
    });

    // two decisions in one request, and a reviewer should see both
    expect(res.body.audited).toEqual(["user.role_changed", "user.deactivated"]);
    expect(await AuditLogModel.countDocuments({ targetType: "User" })).toBe(2);
  });

  it("writes nothing when the request asks for what is already true", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, { role: "faculty", reason: WHY });

    expect(res.status).toBe(200);
    expect(res.body.audited).toEqual([]);
    expect(await AuditLogModel.countDocuments({ targetType: "User" })).toBe(0);
  });
});

describe("who may do it", () => {
  it("refuses an admin changing their own account", async () => {
    const { admin } = await seedPeople();

    const res = await patch(admin.id, admin.token, { isActive: false, reason: WHY });

    // the one move that can lock the last administrator out, with no
    // endpoint left to undo it
    expect(res.status).toBe(403);
    expect((await reload(admin.id)).isActive).toBe(true);
  });

  it("refuses a faculty member", async () => {
    const { faculty, student } = await seedPeople();

    const res = await patch(student.id, faculty.token, { isActive: false, reason: WHY });

    expect(res.status).toBe(403);
  });

  it("refuses a student", async () => {
    const { faculty, student } = await seedPeople();

    const res = await patch(faculty.id, student.token, { isActive: false, reason: WHY });

    expect(res.status).toBe(403);
  });

  it("requires a reason", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, { isActive: false });

    expect(res.status).toBe(400);
  });

  it("refuses a request that changes nothing", async () => {
    const { admin, faculty } = await seedPeople();

    const res = await patch(faculty.id, admin.token, { reason: WHY });

    expect(res.status).toBe(400);
  });
});

describe("creating an account", () => {
  it("records user.created, not a role change that never happened", async () => {
    const { admin } = await seedPeople();

    const res = await request(app)
      .post("/api/auth/users")
      .set(bearer(admin.token))
      .send({
        email: `made${run}@example.com`,
        password: "a-long-enough-password",
        name: "New Person",
        role: "faculty",
      });

    expect(res.status).toBe(201);
    expect(res.body.audited).toBe(true);
    const entry = await AuditLogModel.findOne({ targetType: "User" }).lean();
    // the old entry said user.role_changed with before: null, which reads as
    // a privilege escalation to anyone auditing it
    expect(entry?.action).toBe("user.created");
  });
});
