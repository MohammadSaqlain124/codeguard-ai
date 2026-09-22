import { existsSync } from "node:fs";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

type Role = "student" | "faculty" | "admin";

export const PASSWORD = "codeguard-dev-2026";
export const TEST_DB = "codeguard_test";
export const TEST_BUCKET = "submissions-test";

type Modules = {
  db: typeof import("../src/db/connect.js");
  redis: typeof import("../src/db/redis.js");
  models: typeof import("../src/models/index.js");
  storage: typeof import("../src/storage/minio.js");
  password: typeof import("../src/utils/password.js");
};

let mods: Modules | undefined;
let app: Express | undefined;
let passwordHash = "";

// Points every setting at test resources. It must run before any module
// that reads the environment is imported, which is why those imports are dynamic.
function useTestSettings() {
  if (existsSync("../../infra/.env")) process.loadEnvFile("../../infra/.env");
  process.env.MONGO_URI = (process.env.MONGO_URI ?? "").replace("/codeguard?", `/${TEST_DB}?`);
  process.env.MINIO_BUCKET = TEST_BUCKET;
  if (!process.env.MONGO_URI.includes(`/${TEST_DB}?`)) {
    throw new Error(`Refusing to run: tests must use the ${TEST_DB} database`);
  }
}

async function clearRateLimits() {
  const keys = await mods!.redis.redis.keys("rl:*");
  if (keys.length > 0) await mods!.redis.redis.del(...keys);
}

async function emptyTestBucket() {
  const { storageClient } = mods!.storage;
  if (!(await storageClient.bucketExists(TEST_BUCKET))) return;
  const keys: string[] = [];
  for await (const o of storageClient.listObjectsV2(TEST_BUCKET, "", true)) {
    if (o.name) keys.push(o.name);
  }
  if (keys.length > 0) await storageClient.removeObjects(TEST_BUCKET, keys);
  await storageClient.removeBucket(TEST_BUCKET);
}

export async function startTestApp() {
  useTestSettings();
  const loaded: Modules = {
    db: await import("../src/db/connect.js"),
    redis: await import("../src/db/redis.js"),
    models: await import("../src/models/index.js"),
    storage: await import("../src/storage/minio.js"),
    password: await import("../src/utils/password.js"),
  };

  await loaded.db.connectDb();
  // check the database we actually reached, before anything is cleared
  if (mongoose.connection.name !== TEST_DB) {
    await loaded.db.disconnectDb();
    throw new Error(`Refusing to run: connected to "${mongoose.connection.name}", not ${TEST_DB}`);
  }
  mods = loaded;

  await loaded.models.initModels();
  await loaded.models.clearAllCollections();
  await loaded.redis.connectRedis();
  await clearRateLimits();
  await emptyTestBucket();
  await loaded.storage.ensureBucket();
  passwordHash = await loaded.password.hashPassword(PASSWORD);

  const { createApp } = await import("../src/app.js");
  app = createApp();

  return { app, models: loaded.models, storage: loaded.storage, redis: loaded.redis.redis };
}

export async function stopTestApp() {
  // if start refused or failed before the guard, there is nothing of ours to clean
  if (!mods) return;
  await mods.models.clearAllCollections();
  await emptyTestBucket();
  await clearRateLimits();
  await mods.redis.disconnectRedis();
  await mods.db.disconnectDb();
  mods = undefined;
}

// creates a user directly in the database and returns its id
export async function createUser(role: Role, email: string, rollNo?: string) {
  const u = await mods!.models.UserModel.create({ email, name: `Test ${role}`, role, rollNo, passwordHash });
  return String(u._id);
}

// creates a user and logs in through the real API
export async function signIn(role: Role, email: string, rollNo?: string) {
  const id = await createUser(role, email, rollNo);
  const res = await request(app!).post("/api/auth/login").send({ email, password: PASSWORD });
  const token = pick(res.body, "accessToken");
  if (!token) throw new Error(`login failed for ${email}: ${res.status}`);
  return { id, token: token as string };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// finds a key at the top level or one level down (e.g. body.user.role)
export function pick(body: any, key: string): any {
  if (body && key in body) return body[key];
  for (const v of Object.values(body ?? {})) {
    if (v && typeof v === "object" && key in v) return (v as any)[key];
  }
  return undefined;
}
