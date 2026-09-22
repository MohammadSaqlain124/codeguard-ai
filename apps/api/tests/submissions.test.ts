import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";
import request from "supertest";

import { TEST_BUCKET, bearer, signIn, startTestApp, stopTestApp } from "./helpers.js";

type Who = { id: string; token: string };
type Started = Awaited<ReturnType<typeof startTestApp>>;

let app: Express;
let models: Started["models"];
let storage: Started["storage"];
let sharma: Who, s1: Who, s2: Who, s3: Who, s4: Who;
let A = "", B = "", R = "";
let first: any;

const DAY = 24 * 60 * 60 * 1000;
const code = Buffer.from("def add(a, b):\n    return a + b\n");

beforeAll(async () => {
  ({ app, models, storage } = await startTestApp());
  sharma = await signIn("faculty", "sharma@example.com");
  s1 = await signIn("student", "s1@example.com", "BCS2023126");
  s2 = await signIn("student", "s2@example.com", "BCS2023143");
  s3 = await signIn("student", "s3@example.com", "BCS2023148");
  s4 = await signIn("student", "s4@example.com", "BCS2023125");

  // s3 is deliberately not enrolled
  const course = await models.CourseModel.create({
    code: "CS-501", title: "DAA", academicYear: "2026-27", faculty: sharma.id,
    enrolledStudents: [s1.id, s2.id, s4.id],
  });
  const make = async (title: string, extra: object) =>
    String((await models.AssignmentModel.create({
      course: course._id, title, language: "python", isPublished: true,
      dueAt: new Date(Date.now() + 7 * DAY), ...extra,
    }))._id);

  A = await make("Sorting", { maxSubmissions: 2 });
  B = await make("Past due", { dueAt: new Date(Date.now() - DAY), acceptsLate: true });
  R = await make("Race", { maxSubmissions: 5 });
}, 30_000);

afterAll(async () => {
  await stopTestApp();
});

const submit = (who: Who, assignment: string, content: Buffer, name: string) =>
  request(app).post(`/api/assignments/${assignment}/submissions`).set(bearer(who.token)).attach("file", content, name);

// collects a binary response body into a Buffer
function asBytes(res: any, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(c));
  res.on("end", () => done(null, Buffer.concat(chunks)));
}

describe("uploading", () => {
  it("checks who you are before reading the file", async () => {
    const big = Buffer.alloc(300 * 1024, "a");
    const anon = await request(app).post(`/api/assignments/${A}/submissions`).attach("file", big, "big.py");
    const staff = await submit(sharma, A, big, "big.py");
    expect(anon.status).toBe(401);
    expect(staff.status).toBe(403);
  });

  it("stores a first attempt without exposing the storage key", async () => {
    const res = await submit(s1, A, code, "sort.py");
    expect(res.status).toBe(201);
    first = res.body.submission;
    expect(first.attempt).toBe(1);
    expect(first.isLate).toBe(false);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toHaveProperty("objectKey");
  });

  it("refuses a file in the wrong language", async () => {
    const res = await submit(s1, A, Buffer.from("class A {}"), "A.java");
    expect(res.status).toBe(415);
  });

  it("counts attempts and stops at the limit", async () => {
    expect((await submit(s1, A, Buffer.concat([code, Buffer.from("\n")]), "sort.py")).status).toBe(201);
    const third = await submit(s1, A, code, "sort.py");
    expect(third.status).toBe(409);
    expect(third.body.error.message).toContain("attempts");
  });

  it("accepts identical content from another student without saying so", async () => {
    const res = await submit(s2, A, code, "mine.py");
    expect(res.status).toBe(201);
    expect(res.body.submission.contentHash).toBe(first.contentHash);
  });

  it("hides the assignment from a student who isn't enrolled", async () => {
    expect((await submit(s3, A, code, "sort.py")).status).toBe(404);
  });

  it("marks late work, or refuses it when late work isn't accepted", async () => {
    const late = await submit(s1, B, code, "sort.py");
    expect(late.status).toBe(201);
    expect(late.body.submission.isLate).toBe(true);

    await models.AssignmentModel.updateOne({ _id: B }, { acceptsLate: false });
    const refused = await submit(s2, B, code, "sort.py");
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toContain("deadline");
  });
});

describe("two uploads at the same moment", () => {
  it("never leaves a file without a record", async () => {
    const [x, y] = await Promise.all([submit(s2, R, code, "a.py"), submit(s2, R, code, "b.py")]);

    // usually one 201 and one 409; if timing serialises them, two 201s are also correct
    for (const r of [x, y]) {
      if (r.status !== 201) {
        expect(r.status).toBe(409);
        expect(r.body.error.message).toContain("in progress");
      }
    }

    const records = await models.SubmissionModel.countDocuments({ assignment: R });
    const files: string[] = [];
    for await (const o of storage.storageClient.listObjectsV2(TEST_BUCKET, `${R}/`, true)) {
      if (o.name) files.push(o.name);
    }
    expect(records).toBe([x, y].filter((r) => r.status === 201).length);
    expect(files.length).toBe(records);
    console.log(`race statuses: ${x.status}, ${y.status}`);
  });
});

describe("upload rate limit", () => {
  it("allows ten uploads per ten minutes, then answers 429", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await submit(s4, R, code, "x.py")).status);

    // R allows 5 attempts, so uploads 6 to 10 are refused by the controller;
    // the 11th is stopped by the limiter before it gets that far
    expect(codes.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(codes.slice(5, 10)).toEqual([409, 409, 409, 409, 409]);
    expect(codes[10]).toBe(429);
  });
});

describe("reading submissions", () => {
  it("lets a student download their own file, byte for byte", async () => {
    const res = await request(app).get(`/api/submissions/${first._id ?? first.id}/file`)
      .set(bearer(s1.token)).buffer(true).parse(asBytes);
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body, code)).toBe(0);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toContain('filename="sort.py"');
  });

  it("gives a classmate 404 for someone else's work", async () => {
    const id = first._id ?? first.id;
    expect((await request(app).get(`/api/submissions/${id}`).set(bearer(s2.token))).status).toBe(404);
    expect((await request(app).get(`/api/submissions/${id}/file`).set(bearer(s2.token))).status).toBe(404);
  });

  it("shows faculty every submission, with roll numbers", async () => {
    const res = await request(app).get(`/api/assignments/${A}/submissions`).set(bearer(sharma.token));
    expect(res.body.total).toBe(3);
    const rolls = res.body.items.map((i: any) => i.student.rollNo).sort();
    expect(rolls).toEqual(["BCS2023126", "BCS2023126", "BCS2023143"]);
  });

  it("shows a student only their own, whatever they ask for", async () => {
    const res = await request(app).get(`/api/assignments/${A}/submissions?student=${s2.id}`).set(bearer(s1.token));
    expect(res.body.total).toBe(2);
    expect(res.body.items.every((i: any) => i.student.rollNo === "BCS2023126")).toBe(true);
  });
});
