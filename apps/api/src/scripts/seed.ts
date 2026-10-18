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


import { hashPassword } from "../utils/password.js";

const SEED_PASSWORD = "codeguard-dev-2026";
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
  "Krishna", "Vanshika", "Trisha", "Shubham", "Priya", "Rohan", "Ananya", "Karan",
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

// tag makes the source differ per assignment, so a student's hw1 and hw2
// are not byte-identical to each other
function variantFor(i: number, tag: string) {
  // these two share a source *within* one assignment — the pair the hash short-circuit should find
  if (i % 11 === 0) return `${BASE}# ${tag}\n`;
  if (i % 11 === 1) return `${BASE}# ${tag}\n`;
  if (i % 11 === 2) return `${RENAMED}# ${tag} ${i}\n`;     // level 1: text differs, AST matches
  if (i % 11 === 3) return `${REFORMATTED}# ${tag} ${i}\n`; // level 2: whitespace only
  return `${INDEPENDENT}# ${tag} ${i}\n`;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function seed() {
  const PLACEHOLDER_HASH = await hashPassword(SEED_PASSWORD);
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
  const takehomeSubs: {
    id: Types.ObjectId;
    student: Types.ObjectId;
    assignment: Types.ObjectId;
    source: string;
  }[] = [];

  for (const [i, student] of students.entries()) {
    for (const a of [lab, hw1, hw2]) {
      // not everyone submits everything
      if (a !== lab && rand() < 0.12) continue;

      const source = a === lab ? `${BASE}# lab ${i}\n` : variantFor(i, a.title);
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

      if (a !== lab) {
        takehomeSubs.push({
          id: sub._id,
          student: student._id,
          assignment: a._id,
          source,
        });
      }
    }
  }
  console.log(`submissions: ${created}`);

  // ---- detection results ----
  // keyed by assignment, because the real short-circuit query is scoped to one
  // assignment — comparing a sorting exercise against a graph traversal is meaningless
  const byHash = new Map<string, Types.ObjectId>();
  let flagged = 0;

  // candidates come from the same assignment, the way findCandidates scopes them
  const byAssignment = new Map<string, typeof takehomeSubs>();
  for (const s of takehomeSubs) {
    const key = String(s.assignment);
    byAssignment.set(key, [...(byAssignment.get(key) ?? []), s]);
  }

  // The baseline a student is measured against. Plausible values for real
  // Python, so the per-feature table reads like something a tool measured.
  const BASELINES: [string, number, number][] = [
    ["avg_line_length", 34, 4],
    ["blank_line_ratio", 0.12, 0.03],
    ["comment_density", 0.09, 0.03],
    ["avg_identifier_length", 6.2, 0.8],
    ["underscore_identifier_ratio", 0.35, 0.09],
    ["avg_function_lines", 11, 3],
    ["functions_per_100_lines", 7.5, 1.8],
    ["max_block_depth", 3.1, 0.6],
    ["avg_params_per_function", 2.1, 0.5],
    ["for_loop_ratio", 0.45, 0.12],
  ];

  // three uniforms summed is close enough to a bell curve, and is one line
  const normal = () => rand() + rand() + rand() - 1.5;

  type Pair = {
    other: (typeof takehomeSubs)[number];
    similarity: number;
    compared: boolean;
  };

  // PASS 1. Every pair is scored first, because a cohort z-score needs the
  // cohort's distribution and that does not exist until the pairs do.
  const pairsFor = new Map<string, Pair[]>();
  const twinOf = new Map<string, Types.ObjectId>();

  for (const s of takehomeSubs) {
    const key = `${s.assignment}:${sha256(s.source)}`;
    const twin = byHash.get(key);
    byHash.set(key, s.id);
    if (twin) twinOf.set(String(s.id), twin);

    const peers = (byAssignment.get(String(s.assignment)) ?? []).filter(
      (p) => !p.id.equals(s.id),
    );
    // four is enough to look like evidence without making the page a wall
    const sample = peers.slice(0, 4);

    const pairs: Pair[] = sample.map((p, i) => {
      const isTwin = twin !== undefined && p.id.equals(twin);
      return {
        other: p,
        similarity: isTwin ? 1 : round2(between(0.08, 0.72) * (1 - i * 0.1)),
        // Finding 4. The October measurement put the share of pairs the
        // detector refuses to score, because every unit pairing is too far
        // apart in size, between 5.7 and 16.4 per cent.
        compared: isTwin ? true : rand() > 0.1,
      };
    });

    // the twin has to be in the list, or an exact duplicate shows a score of 1
    // with nothing to point at
    if (twin && !pairs.some((p) => p.other.id.equals(twin))) {
      const twinSub = peers.find((p) => p.id.equals(twin));
      if (twinSub) pairs.unshift({ other: twinSub, similarity: 1, compared: true });
    }

    pairsFor.set(String(s.id), pairs);
  }

  // The cohort's own distribution, per assignment, over the pairs that were
  // actually scored. A similarity read without this is a bare number.
  const cohort = new Map<string, { mean: number; sd: number }>();
  for (const [key, subs] of byAssignment) {
    const scored = subs.flatMap((s) =>
      (pairsFor.get(String(s.id)) ?? []).filter((p) => p.compared).map((p) => p.similarity),
    );
    const mean = scored.reduce((a, b) => a + b, 0) / Math.max(1, scored.length);
    const variance =
      scored.reduce((total, v) => total + (v - mean) ** 2, 0) / Math.max(1, scored.length - 1);
    cohort.set(key, { mean, sd: Math.sqrt(variance) || 0.01 });
  }

  // PASS 2. Write the results.
  for (const s of takehomeSubs) {
    const pairs = pairsFor.get(String(s.id)) ?? [];
    const twin = twinOf.get(String(s.id));
    const { mean, sd } = cohort.get(String(s.assignment)) ?? { mean: 0, sd: 0.01 };

    const matches = pairs.map((p) => ({
      otherSubmission: p.other.id,
      otherStudent: p.other.student,
      similarity: p.similarity,
      cohortZScore: p.compared ? round2((p.similarity - mean) / sd) : 0,
      compared: p.compared,
      // MIN_SPAN_SIMILARITY in the detector is 0.7, so weaker pairs report none
      spans:
        p.compared && p.similarity >= 0.7
          ? [{ aStart: 1, aEnd: 14, bStart: 1, bEnd: 14 }]
          : [],
    }));

    // Derived from the matches, the way runDetection derives it: the best
    // similarity among the pairs that were actually scored. A pair nobody
    // scored reports 0, and letting that stand as the answer would report a
    // measurement nobody made.
    const scored = matches.filter((m) => m.compared);
    const structural = scored.length > 0 ? Math.max(...scored.map((m) => m.similarity)) : 0;

    // most students have the lab anchor; a few do not, so Layer 2 skips
    const hasBaseline = rand() > 0.15;
    const confidence = hasBaseline ? round2(between(0.45, 0.9)) : round2(between(0.05, 0.35));
    const attenuated = confidence < 0.4;

    // Features first, then the score, because that is the direction the real
    // layer works in: score = min(1, rms(z) / Z_SATURATION), Z_SATURATION = 3.
    // Generating a score and a table separately is how they end up disagreeing.
    const strength = between(0.3, 2.6);
    const features = BASELINES.map(([feature, baseMean, baseSd]) => {
      const zScore = round2(normal() * strength);
      return {
        feature,
        value: round2(baseMean + zScore * baseSd),
        baselineMean: baseMean,
        baselineStdDev: baseSd,
        zScore,
      };
    });
    const rms = Math.sqrt(
      features.reduce((total, f) => total + f.zScore ** 2, 0) / features.length,
    );
    const behavioral = hasBaseline ? round2(Math.min(1, rms / 3)) : undefined;

    const w1 = 0.4;
    const w2 = 0.3;
    const w3 = 0.3;
    const effectiveW2 = attenuated || !hasBaseline ? round2(w2 * (confidence / 0.4)) : w2;

    // Renormalised over the layers that ran, the same way runDetection does
    // it. The earlier version here summed w1*structural + w2*behavioural +
    // w3*ai, which is not the formula the system uses and, with Layer 2
    // skipped, produced an rps that did not equal the only score there was.
    // The evidence page shows this arithmetic, so seeded data that does not
    // satisfy it reads as a bug in the detector rather than in the fixture.
    //
    // Not rounded, deliberately: the page recomputes the contributions from
    // the stored weights, and a rounded total would not match the sum shown
    // beneath it.
    const l1ok = scored.length > 0;
    const l2ok = behavioral !== undefined;
    const activeWeight = (l1ok ? w1 : 0) + (l2ok ? effectiveW2 : 0);
    const rps =
      activeWeight > 0
        ? ((l1ok ? w1 * structural : 0) + (l2ok ? effectiveW2 * behavioral : 0)) / activeWeight
        : 0;

    // Two layers that both ran and landed on opposite sides of the review
    // threshold, which is what runDetection records. Not a comparison against
    // a Layer 3 score, because there is no Layer 3.
    const disagreement = l1ok && l2ok && structural >= 0.5 !== behavioral >= 0.5;

    await DetectionResultModel.create({
      submission: s.id,
      assignment: s.assignment,
      course: daa._id,
      student: s.student,
      language: "python",
      structural: l1ok
        ? {
            status: "ok",
            score: structural,
            durationMs: Math.floor(between(800, 2400)),
            exactDuplicateOf: twin,
            candidatesConsidered: matches.length,
            cohortSampleSize: matches.length,
            cohortComputedAt: new Date(),
            matches,
          }
        : {
            status: "skipped",
            reason:
              `${matches.length} candidates were considered and none could be scored, ` +
              `every unit pairing being too far apart in size to compare`,
            durationMs: Math.floor(between(800, 2400)),
            candidatesConsidered: matches.length,
            cohortSampleSize: matches.length,
            matches,
          },
      behavioral: hasBaseline
        ? {
            status: "ok",
            score: behavioral,
            durationMs: Math.floor(between(40, 180)),
            baselineConfidence: confidence,
            anchorCount: Math.floor(between(3, 6)),
            features,
            lowVariance: {
              // flagged only when the percentile is actually low, which is
              // what lowVariancePercentile means. The earlier fixture drew the
              // flag and the percentile independently, so a flagged student
              // could sit at the 81st percentile.
              flagged: false,
              intraStudentVariance: round2(between(0.05, 0.9)),
              cohortPercentile: Math.floor(between(6, 99)),
            },
          }
        : {
            status: "skipped",
            reason: "fewer than 3 invigilated anchors",
            baselineConfidence: confidence,
            anchorCount: Math.floor(between(0, 3)),
          },
      // What runDetection actually writes. The earlier fixture recorded
      // status "ok" with a score and a modelName, which claimed a working
      // Layer 3 the project does not have and has never had.
      aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" },
      rps,
      weights: { w1, w2, w3, effectiveW2 },
      // 0 because CS-501 has no DetectionConfig row, so these results were
      // produced by the defaults. Only CS-101 gets a saved config above.
      configVersion: 0,
      detectorVersion: "0.3.1-seed",
      signalDisagreement: disagreement,
      totalDurationMs: Math.floor(between(2000, 5500)),
    });

    if (rps >= 0.5) flagged++;
  }
  console.log(`detection results: ${takehomeSubs.length} (${flagged} at or above threshold)`);

  // ---- audit trail ----
  const top = await DetectionResultModel.find({ course: daa._id }).sort({ rps: -1 }).limit(2);

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
      {
        "review.status": "escalated",
        "review.reviewedBy": sharma._id,
        "review.reviewedAt": new Date(),
      },
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

  console.log(`\nlogin (password: ${SEED_PASSWORD}):`);
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
