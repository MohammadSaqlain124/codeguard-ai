import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { connectDb, disconnectDb } from "../db/connect.js";
import {
  AssignmentModel,
  AuditLogModel,
  CourseModel,
  DetectionConfigModel,
  DetectionResultModel,
  SubmissionModel,
  UserModel,
  clearAllCollections,
  initModels,
} from "../models/index.js";

// bcrypt arrives in Phase 2; nobody can log in with this
const PLACEHOLDER_HASH = "seed-placeholder-replace-when-bcrypt-lands";

// deterministic PRNG (mulberry32) so every teammate seeds identical data
function makeRng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(20262027);

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const round2 = (n: number) => Math.round(n * 100) / 100;

const FIRST = [
  "Aarav", "Vanshika", "Trisha", "Shubham", "Priya", "Rohan", "Ananya", "Karan",
  "Ishita", "Devansh", "Meera", "Arjun", "Sneha", "Kabir", "Riya", "Aditya",
  "Nisha", "Varun", "Pooja", "Harsh", "Simran", "Yash", "Kavya", "Manav",
  "Diya", "Rahul", "Tanya", "Nikhil", "Shreya", "Aman",
];
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Reddy", "Nair", "Das", "Joshi", "Mehta"];

// one base solution plus three transformations, so Layer 1 has something real to find
const BASE = `def solve(nums):
    result = []
    for n in nums:
        if n % 2 == 0:
            result.append(n * 2)
    return sorted(result)
`;

const RENAMED = `def solve(values):
    out = []
    for v in values:
        if v % 2 == 0:
            out.append(v * 2)
    return sorted(out)
`;

const REFORMATTED = `def solve(nums):

    result = []

    for n in nums:
        if n % 2 == 0:
            result.append( n * 2 )

    return sorted( result )
`;

const INDEPENDENT = `def solve(nums):
    return sorted(x * 2 for x in nums if not x % 2)
`;

function variantFor(i: number) {
  if (i % 11 === 0) return BASE;          // the "original"
  if (i % 11 === 1) return BASE;          // exact duplicate — tests the hash short-circuit
  if (i % 11 === 2) return RENAMED;       // level 1 obfuscation
  if (i % 11 === 3) return REFORMATTED;   // level 2 obfuscation
  return `${INDEPENDENT}# student ${i}\n`;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function seed() {
  await connectDb();
  await initModels();
  await clearAllCollections();
  console.log("cleared");

  // ---- users ----
  const admin = await UserModel.create({
    email: "admin@invertis.ac.in",
    passwordHash: PLACEHOLDER_HASH,
    name: "System Admin",
    role: "admin",
  });

  const sharma = await UserModel.create({
    email: "ashish.sharma@invertis.ac.in",
    passwordHash: PLACEHOLDER_HASH,
    name: "Ashish Sharma",
    role: "faculty",
  });

  // rollNo omitted, not null — sparse indexes skip missing fields only
  const verma = await UserModel.create({
    email: "r.verma@invertis.ac.in",
    passwordHash: PLACEHOLDER_HASH,
    name: "Rekha Verma",
    role: "faculty",
  });

  const students = await UserModel.create(
    FIRST.map((first, i) => ({
      email: `${first.toLowerCase()}.${i + 1}@invertis.ac.in`,
      passwordHash: PLACEHOLDER_HASH,
      name: `${first} ${pick(LAST)}`,
      role: "student" as const,
      rollNo: `BCS2023${String(101 + i).padStart(3, "0")}`,
    })),
  );
  console.log(`users: 1 admin, 2 faculty, ${students.length} students`);

  // ---- courses ----
  const ids = students.map((s) => s._id);
  const daa = await CourseModel.create({
    code: "CS-501",
    title: "Design and Analysis of Algorithms",
    academicYear: "2026-27",
    faculty: sharma._id,
    enrolledStudents: ids,
  });
  const intro = await CourseModel.create({
    code: "CS-101",
    title: "Introduction to Programming",
    academicYear: "2026-27",
    faculty: verma._id,
    enrolledStudents: ids.slice(0, 20),
  });

  // CS-101 overrides the defaults: everyone writes the same 20-line exercise,
  // so structural similarity is naturally high and w1 must come down
  await DetectionConfigModel.create({
    course: intro._id,
    updatedBy: verma._id,
    w1: 0.2,
    w2: 0.5,
    w3: 0.3,
    updatedAt: new Date(),
  });
  console.log("courses: CS-501 (defaults), CS-101 (w1 lowered to 0.2)");

  // ---- assignments ----
  const lab = await AssignmentModel.create({
    course: daa._id,
    title: "Lab 1 — Sorting under supervision",
    description: "In-lab exercise. Written during the scheduled session.",
    language: "python",
    provenance: "invigilated",
    dueAt: new Date("2026-08-14T12:30:00Z"),
    isPublished: true,
  });
  const hw1 = await AssignmentModel.create({
    course: daa._id,
    title: "Assignment 1 — Even doubling",
    language: "python",
    dueAt: new Date("2026-09-04T18:30:00Z"),
    isPublished: true,
  });
  const hw2 = await AssignmentModel.create({
    course: daa._id,
    title: "Assignment 2 — Graph traversal",
    language: "python",
    dueAt: new Date("2026-09-25T18:30:00Z"),
    isPublished: true,
  });
  console.log("assignments: 1 invigilated, 2 take-home");

  // ---- submissions ----
  let created = 0;
  const takehomeSubs: { id: Types.ObjectId; student: Types.ObjectId; source: string }[] = [];

  for (const [i, student] of students.entries()) {
    for (const a of [lab, hw1, hw2]) {
      // not everyone submits everything
      if (a !== lab && rand() < 0.12) continue;

      const source = a === lab ? `${BASE}# lab ${i}\n` : variantFor(i);
      const hash = sha256(source);

      const sub = await SubmissionModel.create({
        assignment: a._id,
        student: student._id,
        attempt: 1,
        provenance: a.provenance,
        language: a.language,
        originalFilename: "solution.py",
        objectKey: `2026-27/${daa.code}/${a._id}/${student._id}/1.py`,
        sizeBytes: Buffer.byteLength(source),
        contentHash: hash,
        lineCount: source.split("\n").length,
        submittedAt: new Date(a.dueAt.getTime() - Math.floor(between(1, 72)) * 3600_000),
        // invigilated work is trusted by construction; take-home is not
        baselineEligible: a.provenance === "invigilated",
        status: "analyzed",
      });
      created++;

      if (a !== lab) takehomeSubs.push({ id: sub._id, student: student._id, source });
    }
  }
  console.log(`submissions: ${created}`);

  // ---- detection results ----
  const byHash = new Map<string, Types.ObjectId>();
  let flagged = 0;

  for (const s of takehomeSubs) {
    const hash = sha256(s.source);
    const twin = byHash.get(hash);
    byHash.set(hash, s.id);

    const structural = twin ? 1 : round2(between(0.08, 0.72));
    // most students have the lab anchor; a few do not, so Layer 2 skips
    const hasBaseline = rand() > 0.15;
    const confidence = hasBaseline ? round2(between(0.45, 0.9)) : round2(between(0.05, 0.35));
    const attenuated = confidence < 0.4;

    const behavioral = hasBaseline ? round2(between(0.05, 0.85)) : undefined;
    const aiScore = round2(between(0.02, 0.94));

    const w1 = 0.4;
    const w2 = 0.3;
    const w3 = 0.3;
    const effectiveW2 = attenuated || !hasBaseline ? round2(w2 * (confidence / 0.4)) : w2;
    const rps = round2(w1 * structural + effectiveW2 * (behavioral ?? 0) + w3 * aiScore);

    // the layers disagree when one is high and another is near zero
    const disagreement =
      aiScore > 0.75 && behavioral !== undefined && behavioral < 0.2;

    await DetectionResultModel.create({
      submission: s.id,
      assignment: hw1._id,
      course: daa._id,
      student: s.student,
      language: "python",
      structural: twin
        ? { status: "ok", score: 1, durationMs: 12, exactDuplicateOf: twin, candidatesConsidered: 0 }
        : { status: "ok", score: structural, durationMs: Math.floor(between(800, 2400)), candidatesConsidered: 29 },
      behavioral: hasBaseline
        ? {
            status: "ok",
            score: behavioral,
            durationMs: Math.floor(between(40, 180)),
            baselineConfidence: confidence,
            anchorCount: Math.floor(between(3, 6)),
            lowVariance: {
              flagged: rand() < 0.08,
              intraStudentVariance: round2(between(0.05, 0.9)),
              cohortPercentile: Math.floor(between(1, 99)),
            },
          }
        : {
            status: "skipped",
            reason: "fewer than 3 invigilated anchors",
            baselineConfidence: confidence,
            anchorCount: Math.floor(between(0, 3)),
          },
      aiContent: {
        status: "ok",
        score: aiScore,
        baselineModelScore: round2(Math.max(0, aiScore - between(0.05, 0.25))),
        modelName: "codebert-base-ft-v1",
        durationMs: Math.floor(between(1500, 3000)),
      },
      rps,
      weights: { w1, w2, w3, effectiveW2 },
      configVersion: 1,
      detectorVersion: "0.3.1-seed",
      signalDisagreement: disagreement,
      totalDurationMs: Math.floor(between(2000, 5500)),
    });

    if (rps >= 0.5) flagged++;
  }
  console.log(`detection results: ${takehomeSubs.length} (${flagged} at or above threshold)`);

  // ---- audit trail ----
  const top = await DetectionResultModel.find({ course: daa._id })
    .sort({ rps: -1 })
    .limit(2);

  for (const r of top) {
    await AuditLogModel.create({
      actor: sharma._id,
      actorRole: "faculty",
      action: "result.escalated",
      targetType: "DetectionResult",
      targetId: r._id,
      course: daa._id,
      changes: { before: { status: "pending" }, after: { status: "escalated" } },
      reason: `RPS ${r.rps} — reviewed and referred to committee.`,
    });
    await DetectionResultModel.updateOne(
      { _id: r._id },
      { "review.status": "escalated", "review.reviewedBy": sharma._id, "review.reviewedAt": new Date() },
    );
  }

  await AuditLogModel.create({
    actor: verma._id,
    actorRole: "faculty",
    action: "config.weights_updated",
    targetType: "DetectionConfig",
    targetId: intro._id,
    course: intro._id,
    changes: { before: { w1: 0.4, w2: 0.3, w3: 0.3 }, after: { w1: 0.2, w2: 0.5, w3: 0.3 } },
    reason: "Everyone writes the same exercise; structural similarity is not informative here.",
  });
  console.log(`audit entries: ${top.length + 1}`);

  console.log(`\nlogin emails (no password until bcrypt lands):`);
  console.log(`  admin    ${admin.email}`);
  console.log(`  faculty  ${sharma.email}`);
  console.log(`  student  ${students[0].email}`);

  await disconnectDb();
}

seed().catch(async (err) => {
  console.error("seed failed:", err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
