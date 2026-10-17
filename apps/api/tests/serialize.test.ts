/**
 * The shared serialisation contract.
 *
 * Every model goes through the serialize plugin, and every client — the web
 * app, its types, and anything built against this API later — reads documents
 * by `id`. Nothing asserted that `id` was actually in a response until this
 * file, and for weeks it was not: schema.set("toJSON", ...) replaces the
 * options rather than merging, so omitting virtuals: true dropped the `id`
 * virtual from every endpoint in the API.
 *
 * It survived that long because the tests read ids as `x.id ?? x._id`. The
 * fallback made them pass and hid the cause, which is the reason this file
 * asserts the contract directly rather than trusting another test to notice.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

let app: Express;
let models: typeof import("../src/models/index.js");

let run = 0;

const OBJECT_ID = /^[a-f0-9]{24}$/;

beforeAll(async () => {
  const started = await startTestApp();
  app = started.app;
  models = started.models;
});

afterAll(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  run += 1;
  await models.clearAllCollections();
});

describe("every serialised document", () => {
  it("carries an id, which is what every client reads", async () => {
    const faculty = await signIn("faculty", `ser${run}@example.com`);

    const res = await request(app)
      .post("/api/courses")
      .set(bearer(faculty.token))
      .send({ code: `CS-4${run % 100}`, title: "Serialisation", academicYear: "2026-27" });

    expect(res.status).toBe(201);
    expect(res.body.course.id).toMatch(OBJECT_ID);
  });

  it("keeps _id as well, so nothing reading the raw field breaks", async () => {
    const faculty = await signIn("faculty", `ser${run}@example.com`);

    const res = await request(app)
      .post("/api/courses")
      .set(bearer(faculty.token))
      .send({ code: `CS-4${run % 100}`, title: "Serialisation", academicYear: "2026-27" });

    expect(String(res.body.course._id)).toBe(res.body.course.id);
  });

  it("still strips __v and the fields a model hides", async () => {
    const student = await signIn("student", `ser${run}@example.com`, `BCS2031${run}1`);

    const res = await request(app).get("/api/auth/me").set(bearer(student.token));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toMatch(OBJECT_ID);
    // turning virtuals on must not have widened what gets sent
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("__v");
  });
});
