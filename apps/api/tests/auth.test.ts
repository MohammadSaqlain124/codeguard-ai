import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import { z } from "zod";
import { validateQuery } from "../src/middleware/validate.js";

// Static imports run before any line of this file. So the modules that read the
// environment (app, db, models) are imported later, in beforeAll, after
// MONGO_URI has been pointed at the test database.
if (existsSync("../../infra/.env")) process.loadEnvFile("../../infra/.env");
process.env.MONGO_URI = (process.env.MONGO_URI ?? "").replace("/codeguard?", "/codeguard_test?");

if (!process.env.MONGO_URI.includes("/codeguard_test?")) {
  throw new Error("Refusing to run: tests must use the codeguard_test database");
}

let app: Express;
let db: typeof import("../src/db/connect.js");
let redis: typeof import("../src/db/redis.js");
let models: typeof import("../src/models/index.js");

beforeAll(async () => {
  db = await import("../src/db/connect.js");
  redis = await import("../src/db/redis.js");
  models = await import("../src/models/index.js");
  const { createApp } = await import("../src/app.js");

  await db.connectDb();
  await models.initModels();
  await models.clearAllCollections();
  await redis.connectRedis();
  app = createApp();
}, 30_000);

afterAll(async () => {
  await models.clearAllCollections();
  await redis.disconnectRedis();
  await db.disconnectDb();
});

// finds a key at the top level or one level down (e.g. body.user.role)
function pick(body: any, key: string): any {
  if (key in body) return body[key];
  for (const v of Object.values(body)) {
    if (v && typeof v === "object" && key in v) return (v as any)[key];
  }
  return undefined;
}

const password = "codeguard-dev-2026";
const student = { email: "sam@example.com", password, name: "Sam Test", rollNo: "BCS2023126" };
const faculty = { email: "faculty@example.com", password, name: "Test Faculty", role: "faculty" };

// shared between tests; vitest runs the tests of one file in order
let access = "";
let refresh = "";

describe("POST /register", () => {
  it("creates a student and never returns the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send(student);
    expect(res.status).toBe(201);
    expect(pick(res.body, "role")).toBe("student");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("rejects the same email twice", async () => {
    const res = await request(app).post("/api/auth/register").send(student);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE");
  });

  it("rejects a role sent by the client", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...student, email: "x@example.com", role: "admin" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("POST /login", () => {
  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await request(app).post("/api/auth/login").send({ email: student.email, password: "wrong-password" });
    const ghost = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password });
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(wrong.body.error.message).toBe(ghost.body.error.message);
  });

  it("returns an access and a refresh token", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: student.email, password });
    expect(res.status).toBe(200);
    access = pick(res.body, "accessToken");
    refresh = pick(res.body, "refreshToken");
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
  });
});

describe("GET /me", () => {
  it("returns the logged-in user", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${access}`);
    expect(res.status).toBe(200);
    expect(pick(res.body, "email")).toBe(student.email);
  });

  it("needs a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("does not accept a refresh token in place of an access token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${refresh}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });
});

describe("POST /refresh and /logout", () => {
  it("rotates: the old refresh token stops working", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(res.status).toBe(200);
    const rotated = pick(res.body, "refreshToken");
    expect(rotated).not.toBe(refresh);

    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(reuse.status).toBe(401);
    refresh = rotated;
  });

  it("logout revokes the refresh token", async () => {
    const out = await request(app).post("/api/auth/logout").send({ refreshToken: refresh });
    expect(out.status).toBe(204);

    const again = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(again.status).toBe(401);
  });
});

describe("POST /users (admin only)", () => {
  // the access token is still valid here: logout revokes only the refresh token

  it("refuses a student", async () => {
    const res = await request(app).post("/api/auth/users").set("Authorization", `Bearer ${access}`).send(faculty);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("reads the role from the database, not from the token", async () => {
    await models.UserModel.updateOne({ email: student.email }, { role: "admin" });
    const res = await request(app).post("/api/auth/users").set("Authorization", `Bearer ${access}`).send(faculty);
    expect(res.status).toBe(201);
    expect(pick(res.body, "role")).toBe("faculty");
  });
});

describe("request ids", () => {
  it("sends the same id in the header and in the error body", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});

describe("validateQuery", () => {
  // a tiny app, because the bug only appears with Express 5's real req.query getter
  const mini = express();
  const schema = z.object({ page: z.coerce.number().int().min(1).default(1) });
  mini.get("/t", validateQuery(schema), (req, res) => {
    res.json({ page: req.query.page, type: typeof req.query.page });
  });

  it("hands the handler a number, not a string", async () => {
    const res = await request(mini).get("/t?page=3");
    expect(res.body).toEqual({ page: 3, type: "number" });
  });

  it("applies defaults", async () => {
    const res = await request(mini).get("/t");
    expect(res.body).toEqual({ page: 1, type: "number" });
  });
});
