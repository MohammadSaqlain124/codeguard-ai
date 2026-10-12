/**
 * The scripted demo. Drives the real HTTP API end to end and prints what
 * happened, so there is something to show without a web interface.
 *
 *   npm run seed     # once, for the users this logs in as
 *   npm run worker   # in a second terminal, and leave it running
 *   npm run demo
 *
 * It talks to the running service over HTTP and reaches into nothing. If a
 * number appears below, an endpoint returned it.
 *
 * The worker is not optional. Uploading only queues a job; detection, the
 * baseline rebuild and the recalibration all happen in the worker, so without
 * it every submission stays "queued" forever. Step 0 checks for that and says
 * so rather than hanging.
 */
import { env } from "../config/env.js";

// the seed's development password, which is in seed.ts and in the repository
const PASSWORD = "codeguard-dev-2026";

const FACULTY = "ashish.sharma@invertis.ac.in";
// seeded as `${first.toLowerCase()}.${i + 1}@invertis.ac.in`, rollNo BCS2023101+
// `key` picks which hand this student writes in, below.
const STUDENTS = [
  { email: "krishna.1@invertis.ac.in", rollNo: "BCS2023101", name: "Krishna", key: "krishna" },
  { email: "vanshika.2@invertis.ac.in", rollNo: "BCS2023102", name: "Vanshika", key: "vanshika" },
  { email: "trisha.3@invertis.ac.in", rollNo: "BCS2023103", name: "Trisha", key: "trisha" },
  { email: "shubham.4@invertis.ac.in", rollNo: "BCS2023104", name: "Shubham", key: "shubham" },
];

const base = argOf("--base") ?? `http://127.0.0.1:${env.API_PORT}`;
const WAIT_MS = 45_000;

function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function heading(text: string) {
  console.log(`\n${text}\n${"-".repeat(text.length)}`);
}

type Options = { token?: string; body?: unknown; file?: { source: string; name: string } };

/** One place that talks HTTP, so a failure is reported the same way everywhere. */
async function call(method: string, path: string, options: Options = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  // not BodyInit: @types/node does not provide that global without the DOM lib
  let payload: FormData | string | undefined;
  if (options.file) {
    const form = new FormData();
    form.append("file", new Blob([options.file.source]), options.file.name);
    payload = form;
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(options.body);
  }

  const res = await fetch(`${base}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const detail = (parsed as { message?: string }).message ?? text.slice(0, 200);
    throw new Error(`${method} ${path} -> ${res.status}: ${detail}`);
  }
  return parsed as Record<string, any>;
}

async function login(email: string) {
  const body = await call("POST", "/api/auth/login", { body: { email, password: PASSWORD } });
  const token = body.accessToken ?? body.tokens?.accessToken;
  if (!token) throw new Error(`login for ${email} returned no access token`);
  return token as string;
}

/* ------------------------------------------------------------------ fixtures
 *
 * Four students who write differently, in the two ways the two layers can
 * actually see. Both are easy to get wrong, and getting either wrong makes
 * the demo print confident nonsense:
 *
 * Layer 1 compares normalised syntax trees. normalise.py turns every
 * identifier into ID and every number into NUM, so renaming variables,
 * changing constants, moving comments and adding blank lines are all
 * invisible to it. Four students writing one template with different names
 * match each other at 1.000, whoever copied from whom. So each student gets
 * a different shape: a different number of functions, and different control
 * flow inside them.
 *
 * Layer 2 divides every deviation by the pooled cohort spread, which is the
 * root mean square of each student's own standard deviation across their
 * anchors. A student whose three sittings are identical has a standard
 * deviation of zero; if that is true of everyone, the pooled spread is zero,
 * every denominator falls back to VARIANCE_FLOOR, and every score pins at 1
 * while cohortHealth reports that the layer is separating nobody. So each
 * student's three sittings vary in all four scored features.
 *
 * Every file is kept above MIN_ANCHOR_LINES, which is 30, or findAnchors
 * ignores it and no baseline is ever built.
 */

const NOTES = [
  "walk the list once and keep only the values that are really numbers here",
  "count and total together so the list is never traversed a second time",
  "guard the empty case first because dividing by zero ends the program",
];

// Vanshika: three small functions, plain for loops.
function skeletonV(deep: boolean): string[] {
  return [
    "def clean(values):",
    "    out = []",
    "    for v in values:",
    "        if v is not None:",
    ...(deep
      ? ["            if v == v:", "                out.append(v)"]
      : ["            out.append(v)"]),
    "    return out",
    "def biggest(values):",
    "    best = None",
    "    for v in values:",
    "        if v is None:",
    "            continue",
    "        if best is None:",
    "            best = v",
    "        elif v > best:",
    "            best = v",
    "    return best",
    "def summarise(values):",
    "    data = clean(values)",
    "    total = 0",
    "    count = 0",
    "    for v in data:",
    "        total = total + v",
    "        count = count + 1",
    "    if count == 0:",
    "        return 0, None",
    "    return total / count, biggest(data)",
  ];
}

// Krishna: one long function, three index driven while loops.
function skeletonK(deep: boolean): string[] {
  return [
    "def summarise(values):",
    "    i = 0",
    "    total = 0",
    "    seen = 0",
    "    while i < len(values):",
    "        v = values[i]",
    "        if v is not None:",
    ...(deep
      ? [
          "            if v == v:",
          "                total = total + v",
          "                seen = seen + 1",
        ]
      : ["            total = total + v", "            seen = seen + 1"]),
    "        i = i + 1",
    "    j = 0",
    "    best = None",
    "    while j < len(values):",
    "        v = values[j]",
    "        if v is not None:",
    // the second loop is already the deepest point in this skeleton, so the
    // extra level has to go here or the file's maximum never moves
    ...(deep
      ? [
          "            if v == v:",
          "                if best is None:",
          "                    best = v",
          "                elif v > best:",
          "                    best = v",
        ]
      : [
          "            if best is None:",
          "                best = v",
          "            elif v > best:",
          "                best = v",
        ]),
    "        j = j + 1",
    "    dropped = 0",
    "    k = 0",
    "    while k < len(values):",
    "        if values[k] is None:",
    "            dropped = dropped + 1",
    "        k = k + 1",
    "    if seen == 0:",
    "        return 0, None, dropped",
    "    return total / seen, best, dropped",
  ];
}

// Trisha: one function, for loops with if and else, several lists.
function skeletonT(deep: boolean): string[] {
  return [
    "def summarise(values):",
    "    kept = []",
    "    dropped = []",
    "    for v in values:",
    "        if v is None:",
    "            dropped.append(v)",
    "        else:",
    ...(deep
      ? ["            if v == v:", "                kept.append(v)"]
      : ["            kept.append(v)"]),
    "    if len(kept) == 0:",
    "        return 0, 0, 0",
    "    total = 0",
    "    for v in kept:",
    "        total = total + v",
    "    mean = total / len(kept)",
    "    above = []",
    "    for v in kept:",
    "        if v > mean:",
    "            above.append(v)",
    "    worst = kept[0]",
    "    for v in kept:",
    "        if v < worst:",
    "            worst = v",
    "    labels = []",
    "    for v in dropped:",
    "        labels.append(len(labels))",
    "    return mean, len(above), len(labels), worst",
  ];
}

// Shubham: four functions, guard clauses and recursion.
function skeletonS(deep: boolean): string[] {
  return [
    "def is_valid(v):",
    "    return v is not None",
    "def add_up(values, i):",
    "    if i >= len(values):",
    "        return 0",
    "    rest = add_up(values, i + 1)",
    "    if is_valid(values[i]):",
    "        return values[i] + rest",
    "    return rest",
    "def count_valid(values, i):",
    "    if i >= len(values):",
    "        return 0",
    "    rest = count_valid(values, i + 1)",
    "    if is_valid(values[i]):",
    "        return 1 + rest",
    "    return rest",
    "def summarise(values):",
    "    good = count_valid(values, 0)",
    "    if good == 0:",
    "        return 0, 0",
    "    total = add_up(values, 0)",
    "    mean = total / good",
    "    above = 0",
    "    for v in values:",
    "        if is_valid(v):",
    "            if v > mean:",
    "                if v > 0:",
    // deep guards are this student's signature, so the extra sitting level
    // goes on the end of the chain rather than anywhere shallower
    ...(deep
      ? ["                    if v == v:", "                        above = above + 1"]
      : ["                    above = above + 1"]),
    "    return mean, above",
  ];
}

// The ghostwriter: comprehensions and a thin pipeline of small functions.
// Nobody in the class writes like this, which is the point.
function skeletonGhost(): string[] {
  return [
    "def load(values):",
    "    return [v for v in values if v is not None]",
    "def average(cleaned):",
    "    if not cleaned:",
    "        return 0",
    "    return sum(cleaned) / len(cleaned)",
    "def spread(cleaned):",
    "    if len(cleaned) < 2:",
    "        return 0",
    "    middle = average(cleaned)",
    "    if middle > 0:",
    "        if len(cleaned) > 3:",
    "            if middle < 1000:",
    "                return max(abs(v - middle) for v in cleaned)",
    "    return 0",
    "def above_mean(cleaned):",
    "    middle = average(cleaned)",
    "    return len([v for v in cleaned if v > middle])",
    "def smallest(cleaned):",
    "    if not cleaned:",
    "        return 0",
    "    return min(cleaned)",
    "def largest(cleaned):",
    "    if not cleaned:",
    "        return 0",
    "    return max(cleaned)",
    "def summarise(values):",
    "    cleaned = load(values)",
    "    return average(cleaned), spread(cleaned), above_mean(cleaned)",
  ];
}

type Skeleton = (deep: boolean) => string[];

const SKELETON: Record<string, Skeleton> = {
  vanshika: skeletonV,
  krishna: skeletonK,
  trisha: skeletonT,
  shubham: skeletonS,
};

type Layout = { commentEvery: number; commentWords: number; blankEvery: number };

// How each student lays code out. These three knobs plus `deep` move exactly
// the four features Layer 2 scores: blank rate, line length, comment density
// and block depth.
const STYLE: Record<string, Layout> = {
  vanshika: { commentEvery: 5, commentWords: 6, blankEvery: 6 },
  krishna: { commentEvery: 7, commentWords: 5, blankEvery: 8 },
  trisha: { commentEvery: 3, commentWords: 9, blankEvery: 4 },
  shubham: { commentEvery: 8, commentWords: 2, blankEvery: 9 },
};

type Jitter = Layout & { deep: boolean };

// One entry per sitting. Every field moves, for the reason in the block
// comment above: a student with three identical sittings has no spread of
// their own, and the cohort's denominator is built out of those spreads.
const JITTER: Jitter[] = [
  { commentEvery: 0, commentWords: 0, blankEvery: 0, deep: false },
  { commentEvery: -1, commentWords: 4, blankEvery: -1, deep: true },
  { commentEvery: 2, commentWords: -1, blankEvery: 2, deep: false },
];

// The honest take-home is a fourth file in the student's own hand, not a copy
// of one of their sittings. The blank rate is deliberately left alone: a
// student's own spread in blank_line_ratio is wider than the pooled cohort
// spread that divides it, so moving the blank rate even one step pushes
// honest work past two standard deviations.
const TAKEHOME_JITTER: Jitter = {
  commentEvery: 1,
  commentWords: 2,
  blankEvery: 0,
  deep: false,
};

const GHOST: Layout = { commentEvery: 3, commentWords: 10, blankEvery: 13 };

function render(lines: string[], layout: Layout): string {
  const out: string[] = [];
  let code = 0;
  for (const line of lines) {
    // a blank line before each new function, which every style keeps
    if (line.startsWith("def ") && out.length > 0) out.push("");
    code += 1;
    if (code % layout.commentEvery === 0) {
      const indent = " ".repeat(line.length - line.trimStart().length);
      const words = NOTES[code % NOTES.length]!.split(" ").slice(0, layout.commentWords);
      out.push(indent + "# " + words.join(" "));
    }
    out.push(line);
    if (code % layout.blankEvery === 0) out.push("");
  }
  return out.join("\n") + "\n";
}

function sourceFor(key: string, jitter: Jitter): string {
  const style = STYLE[key]!;
  return render(SKELETON[key]!(jitter.deep), {
    // a knob below 2 would comment or blank every line, which is nobody's style
    commentEvery: Math.max(2, style.commentEvery + jitter.commentEvery),
    commentWords: Math.max(2, style.commentWords + jitter.commentWords),
    blankEvery: Math.max(2, style.blankEvery + jitter.blankEvery),
  });
}

function sittingSource(key: string, sitting: number): string {
  return sourceFor(key, JITTER[sitting]!);
}

function takehomeSource(key: string): string {
  // Shubham hands in Trisha's file unchanged, which is the only pair Layer 1
  // should find. Krishna hands in work that is not his, which only Layer 2
  // can see, because it matches nobody else in the assignment.
  if (key === "shubham") return sourceFor("trisha", TAKEHOME_JITTER);
  if (key === "krishna") return render(skeletonGhost(), GHOST);
  return sourceFor(key, TAKEHOME_JITTER);
}

/* --------------------------------------------------------------------- run */

async function upload(assignmentId: string, token: string, text: string) {
  const body = await call("POST", `/api/assignments/${assignmentId}/submissions`, {
    token,
    file: { source: text, name: "work.py" },
  });
  return String(body.submission.id ?? body.submission._id);
}

/** Polls until the worker has finished with it, or explains that it has not. */
async function waitAnalysed(submissionId: string, token: string) {
  const until = Date.now() + WAIT_MS;
  let status = "queued";
  while (Date.now() < until) {
    const body = await call("GET", `/api/submissions/${submissionId}`, { token });
    status = body.submission.status;
    if (status === "analyzed" || status === "failed") return status;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(
    `submission ${submissionId} is still "${status}" after ${WAIT_MS / 1000}s.\n` +
      `  Uploading only queues a job. Start the worker in another terminal:\n` +
      `      cd apps/api && npm run worker`,
  );
}

/**
 * Waits until Layer 2 has scored every take-home, and refuses to go on if it
 * has not.
 *
 * The baseline rebuild is a job of its own, enqueued once an anchor has been
 * analysed rather than run inside that analysis. So a take-home uploaded
 * moments after the last sitting can be scored while its author's baseline is
 * still being built, or before enough baselines exist in the cohort to
 * calibrate against. The recalibration job re-analyses the assignment after
 * every detection, so this settles by itself; the thing to avoid is printing
 * a queue in which Layer 2 was skipped, because a skipped layer scores zero
 * and would quietly look like a clean result.
 */
async function waitScored(assignmentId: string, token: string, expected: number) {
  const until = Date.now() + WAIT_MS;
  let waitingOn: string[] = [];
  while (Date.now() < until) {
    const queue = await call("GET", `/api/assignments/${assignmentId}/results`, { token });
    const rows = queue.items as any[];
    waitingOn = rows
      .filter((row) => row.behavioral?.status !== "ok")
      .map(
        (row) =>
          `${row.student?.name ?? row.student}: ` +
          `${row.behavioral?.reason ?? row.behavioral?.status}`,
      );
    if (rows.length >= expected && waitingOn.length === 0) return queue;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(
    `Layer 2 had still not scored every take-home after ${WAIT_MS / 1000}s.\n` +
      `  The api's own reasons, which are the ones to read:\n` +
      waitingOn.map((line) => `      ${line}`).join("\n") +
      `\n  If a baseline is short of anchors, the sittings in step 2 did not all` +
      `\n  become anchors. If the cohort is short of baselines, the recalibration` +
      `\n  job may still be working through the queue.`,
  );
}

/** Fails early, and says what to do, if the api is older than this script. */
async function requireRoutes(token: string) {
  const absent = "0".repeat(24);
  const paths = [`/api/assignments/${absent}/results`, `/api/submissions/${absent}/result`];
  for (const path of paths) {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.text();
    if (body.includes("Route GET")) {
      throw new Error(
        `the api at ${base} has no ${path.replace(absent, ":id")} route.\n` +
          `  It is running older code than this working tree. Rebuild it:\n` +
          `      cd infra && docker compose up -d --build api\n` +
          `  or stop that container and serve the api from source instead:\n` +
          `      cd infra && docker compose stop api\n` +
          `      cd apps/api && npm run dev`,
      );
    }
  }
  console.log("  endpoints      review queue, evidence and review routes present");
}

async function main() {
  heading("0  Is the service up, and is the worker draining the queue?");
  const faculty = await login(FACULTY);
  console.log(`  api            ${base} answered a login`);
  console.log(`  faculty        ${FACULTY}`);
  const tokens: string[] = [];
  for (const s of STUDENTS) tokens.push(await login(s.email));
  console.log(`  students       ${STUDENTS.length} signed in`);

  // A stale api process is the likeliest reason this stops, because the
  // container runs an image rather than the working tree, and the worker runs
  // from source. Probing costs one request and saves sixteen uploads: a route
  // that is not registered answers "Route GET ... not found", while a
  // registered one complains about the assignment instead.
  await requireRoutes(faculty);

  heading("1  A course, four enrolled students, three sittings and one take-home");
  const code = `CS-${(Date.now() % 900) + 100}`;
  const course = await call("POST", "/api/courses", {
    token: faculty,
    body: { code, title: "Demo: Design and Analysis of Algorithms", academicYear: "2026-27" },
  });
  const courseId = String(course.course.id ?? course.course._id);
  console.log(`  course         ${code}`);

  await call("POST", `/api/courses/${courseId}/students`, {
    token: faculty,
    body: { rollNos: STUDENTS.map((s) => s.rollNo) },
  });
  console.log(`  enrolled       ${STUDENTS.map((s) => s.rollNo).join(", ")}`);

  const dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const sittings: string[] = [];
  for (let lab = 1; lab <= 3; lab += 1) {
    const made = await call("POST", `/api/courses/${courseId}/assignments`, {
      token: faculty,
      body: {
        title: `Invigilated lab ${lab}`,
        language: "python",
        provenance: "invigilated",
        dueAt,
        isPublished: true,
      },
    });
    sittings.push(String(made.assignment.id ?? made.assignment._id));
  }
  const takehomeMade = await call("POST", `/api/courses/${courseId}/assignments`, {
    token: faculty,
    body: {
      title: "Take-home assignment",
      language: "python",
      provenance: "takehome",
      dueAt,
      isPublished: true,
    },
  });
  const takehome = String(takehomeMade.assignment.id ?? takehomeMade.assignment._id);
  console.log(`  assignments    3 invigilated, 1 take-home`);

  heading("2  Invigilated work, which is what Layer 2's baselines are built from");
  console.log("  Each student writes in their own shape and their own layout, and varies");
  console.log("  across the three sittings. That variation is the denominator Layer 2");
  console.log("  divides by, so without it no score would separate anybody.");
  for (let i = 0; i < STUDENTS.length; i += 1) {
    const who = STUDENTS[i]!;
    const lengths: number[] = [];
    for (let lab = 0; lab < sittings.length; lab += 1) {
      const text = sittingSource(who.key, lab);
      lengths.push(text.trimEnd().split("\n").length);
      const id = await upload(sittings[lab]!, tokens[i]!, text);
      await waitAnalysed(id, tokens[i]!);
    }
    console.log(`  ${who.name.padEnd(10)} 3 sittings analysed, ${lengths.join("/")} lines`);
  }

  heading("3  Take-home work, with two things planted in it");
  // Krishna writes nothing like his own three sittings, and no second copy
  // exists: that shape is only visible to Layer 2.
  const foreign = await upload(takehome, tokens[0]!, takehomeSource(STUDENTS[0]!.key));
  await waitAnalysed(foreign, tokens[0]!);
  console.log(`  ${STUDENTS[0]!.name.padEnd(10)} submitted work in nobody's hand but its author's`);

  const honest = await upload(takehome, tokens[1]!, takehomeSource(STUDENTS[1]!.key));
  await waitAnalysed(honest, tokens[1]!);
  console.log(`  ${STUDENTS[1]!.name.padEnd(10)} submitted their own work`);

  // Trisha first, then Shubham with the same bytes, so the hash match is
  // found while analysing the second of them.
  const original = await upload(takehome, tokens[2]!, takehomeSource(STUDENTS[2]!.key));
  await waitAnalysed(original, tokens[2]!);
  const copy = await upload(takehome, tokens[3]!, takehomeSource(STUDENTS[3]!.key));
  await waitAnalysed(copy, tokens[3]!);
  console.log(`  ${STUDENTS[2]!.name.padEnd(10)} and ${STUDENTS[3]!.name} handed in the same file`);

  heading("4  The review queue, which is what a faculty member opens");
  const queue = await waitScored(takehome, faculty, STUDENTS.length);
  const rows = queue.items as any[];

  // measured from the data rather than assumed, so a long name cannot push
  // the columns out of line
  const names = rows.map((row) => String(row.student?.name ?? row.student));
  const width = Math.max(12, ...names.map((n) => n.length));

  console.log(
    `  ${"student".padEnd(width)} ${"rps".padStart(6)}  ${"L1".padStart(6)}  ` +
      `${"L2".padStart(6)}  flags`,
  );
  for (const row of rows) {
    const flags: string[] = [];
    if (row.structural?.exactDuplicateOf) flags.push("exact duplicate");
    if (row.behavioral?.lowVariance?.flagged) flags.push("low variance");
    if (row.behavioral?.cohortHealth?.flagged) flags.push("cohort not separating");
    if (row.signalDisagreement) flags.push("layers disagree");
    if (row.behavioral?.status !== "ok") flags.push(`L2 ${row.behavioral?.status}`);
    const name = String(row.student?.name ?? row.student);
    console.log(
      `  ${name.padEnd(width)} ${row.rps.toFixed(3).padStart(6)}  ` +
        `${fmt(row.structural?.score)}  ${fmt(row.behavioral?.score)}  ${flags.join(", ") || "-"}`,
    );
  }
  console.log(`\n  ${queue.total} results, highest first. Nothing here is a verdict.`);

  heading("5  The evidence behind the top one");
  const top = rows[0];
  if (!top) throw new Error("the queue came back empty, so there is nothing to open");
  const topSubmission = String(top.submission);
  const detail = await call("GET", `/api/submissions/${topSubmission}/result`, { token: faculty });
  const r = detail.result;

  console.log(`  student        ${r.student?.name ?? r.student}`);
  console.log(`  rps            ${r.rps}`);
  const w2 = r.weights.effectiveW2;
  console.log(
    `  weights        w1 ${r.weights.w1}, w2 ${r.weights.w2}` +
      `${w2 === r.weights.w2 ? " (not attenuated)" : ` attenuated to ${w2}`}`,
  );
  console.log(`  config         version ${r.configVersion}, detector ${r.detectorVersion}`);
  console.log(`  revisions      ${(detail.revisions as number[]).join(", ")}`);

  if (r.structural?.matches?.length) {
    // Every peer that was compared becomes a match with its similarity, not
    // only the similar ones, so these are the closest peers rather than a
    // list of findings. Reading them as findings is the mistake this label
    // is here to prevent.
    console.log(`\n  Layer 1 compared ${r.structural.matches.length} peers, closest first:`);
    for (const m of r.structural.matches) {
      const who = m.otherStudent?.name ?? m.otherStudent;
      console.log(`    ${String(who).padEnd(width)} similarity ${m.similarity}`);
      for (const s of m.spans ?? []) {
        console.log(`      lines ${s.aStart}-${s.aEnd} against ${s.bStart}-${s.bEnd}`);
      }
    }
  }

  if (r.behavioral?.features?.length) {
    console.log(`\n  Layer 2 compared ${r.behavioral.features.length} features against the baseline:`);
    console.log(
      `    ${"feature".padEnd(22)} ${"value".padStart(8)} ${"baseline".padStart(9)} ` +
        `${"spread".padStart(8)} ${"z".padStart(7)}`,
    );
    for (const f of r.behavioral.features) {
      console.log(
        `    ${f.feature.padEnd(22)} ${f.value.toFixed(3).padStart(8)} ` +
          `${f.baselineMean.toFixed(3).padStart(9)} ${f.baselineStdDev.toFixed(3).padStart(8)} ` +
          `${f.zScore.toFixed(2).padStart(7)}`,
      );
    }
    console.log(`    anchors ${r.behavioral.anchorCount}, confidence ${r.behavioral.baselineConfidence}`);
    if (r.behavioral.cohortHealth?.flagged) {
      console.log(
        `    note: this cohort is not separating (${r.behavioral.cohortHealth.flooredFeatures.join(", ")} floored)`,
      );
    }
  } else if (r.behavioral?.status !== "ok") {
    console.log(`\n  Layer 2 did not score: ${r.behavioral?.reason ?? r.behavioral?.status}`);
  }

  heading("6  A human decides, and the decision is recorded");
  const decided = await call("PATCH", `/api/submissions/${topSubmission}/review`, {
    token: faculty,
    body: {
      status: "escalated",
      note: "Identical file to another submission; referred to the committee.",
    },
  });
  const by = decided.result.review.reviewedBy;
  console.log(`  status         ${decided.result.review.status}`);
  console.log(`  reviewed by    ${by?.name ?? by}`);
  console.log(`  note           ${decided.result.review.note}`);
  console.log(`  audit written  ${decided.audited}`);

  const pending = await call("GET", `/api/assignments/${takehome}/results?reviewStatus=pending`, {
    token: faculty,
  });
  console.log(`\n  ${pending.total} still pending, so the queue shrank by one.`);

  heading("What this showed");
  // Counted from the queue rather than asserted. An earlier version of this
  // script claimed Layer 1 had found the identical pair while it was in fact
  // matching all four students at 1.000, because the fixtures shared one
  // shape. A sentence that cannot check itself should not be printed.
  const duplicates = rows.filter((row) => row.structural?.exactDuplicateOf).length;
  const disagreements = rows.filter((row) => row.signalDisagreement).length;
  const unhealthy = rows.filter((row) => row.behavioral?.cohortHealth?.flagged).length;
  const layer2Only = rows.filter(
    (row) =>
      typeof row.behavioral?.score === "number" &&
      typeof row.structural?.score === "number" &&
      row.behavioral.score > row.structural.score,
  ).length;
  const top1 = Math.max(...rows.map((row) => row.rps as number));
  const bottom = Math.min(...rows.map((row) => row.rps as number));

  console.log(`  ${duplicates} of ${rows.length} rows carry an exact duplicate of another file.`);
  console.log(`  ${layer2Only} scored higher on Layer 2 than on Layer 1, which is the shape of`);
  console.log(`  outsourced work: no classmate to match, only a style that is not theirs.`);
  console.log(`  ${disagreements} rows carry a disagreement flag, where the two layers point`);
  console.log(`  opposite ways and the weighted average would have hidden it.`);
  console.log(`  ${unhealthy} rows report that the cohort is not separating.`);
  console.log(`  RPS runs from ${bottom.toFixed(3)} to ${top1.toFixed(3)}, so the queue ranks.`);
  console.log(`\n  Both scores, the weights behind them and the evidence under both are`);
  console.log(`  readable, and a person made the only decision that was made. The system`);
  console.log(`  ranked and stopped, which is the whole claim.`);
  console.log(`\n  course ${code} is left in place, so the queue can be reopened.`);
}

function fmt(n: unknown) {
  return typeof n === "number" ? n.toFixed(3).padStart(6) : "-".padStart(6);
}

main().catch((err) => {
  console.error(`\nThe demo stopped: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
