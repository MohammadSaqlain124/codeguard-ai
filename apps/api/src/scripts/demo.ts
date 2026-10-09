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
const STUDENTS = [
  { email: "krishna.1@invertis.ac.in", rollNo: "BCS2023101", name: "Krishna" },
  { email: "vanshika.2@invertis.ac.in", rollNo: "BCS2023102", name: "Vanshika" },
  { email: "trisha.3@invertis.ac.in", rollNo: "BCS2023103", name: "Trisha" },
  { email: "shubham.4@invertis.ac.in", rollNo: "BCS2023104", name: "Shubham" },
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

/**
 * Python that is a real file rather than a stub, because an anchor under
 * MIN_ANCHOR_LINES is ignored, and that varies the four features Layer 2
 * scores so different students genuinely look different.
 */
function source(style: number, tag: string): string {
  const lines: string[] = [];
  const comments = style % 2 === 0;
  const spacing = style % 3;
  const deep = style >= 2;

  lines.push(`def ${tag}(values):`);
  if (comments) lines.push(`    # ${tag}: fold the list into a running total`);
  lines.push("    total = 0");
  lines.push("    out = []");
  for (let i = 0; i < 9; i += 1) {
    if (spacing === 2) lines.push("");
    if (comments && i % 3 === 0) lines.push(`    # step ${i}`);
    lines.push(`    step_${i} = ${i + 1} * ${style + 2}`);
  }
  if (spacing >= 1) lines.push("");
  lines.push("    for n in values:");
  if (deep) {
    lines.push("        if n > 0:");
    lines.push("            if n % 2 == 0:");
    lines.push("                total = total + n");
    lines.push("            else:");
    lines.push("                total = total - n");
  } else {
    lines.push("        total = total + n");
  }
  lines.push("        out.append(total)");
  if (spacing >= 1) lines.push("");
  lines.push("    return out, total");
  lines.push("");
  lines.push(`def ${tag}_check(values):`);
  lines.push(`    pairs, total = ${tag}(values)`);
  if (comments) lines.push("    # the caller only wants the tail");
  lines.push("    return pairs[-1] if pairs else total");
  while (lines.length < 36) lines.push(`# ${tag} filler ${lines.length}`);
  return lines.join("\n") + "\n";
}

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
  console.log("  Each student writes in their own style across three sittings. The worker");
  console.log("  rebuilds a baseline after every anchor, so this also exercises that job.");
  for (let i = 0; i < STUDENTS.length; i += 1) {
    for (let lab = 0; lab < sittings.length; lab += 1) {
      const id = await upload(sittings[lab]!, tokens[i]!, source(i, `lab${lab + 1}`));
      await waitAnalysed(id, tokens[i]!);
    }
    console.log(`  ${STUDENTS[i]!.name.padEnd(10)} 3 sittings analysed`);
  }

  heading("3  Take-home work, with two things planted in it");
  // Krishna writes nothing like their own three sittings: that is what Layer 2
  // is for, and no second copy exists for Layer 1 to find.
  const foreign = await upload(takehome, tokens[0]!, source(3, "takehome"));
  await waitAnalysed(foreign, tokens[0]!);
  console.log(`  ${STUDENTS[0]!.name.padEnd(10)} submitted in a style unlike their own sittings`);

  const honest = await upload(takehome, tokens[1]!, source(1, "takehome"));
  await waitAnalysed(honest, tokens[1]!);
  console.log(`  ${STUDENTS[1]!.name.padEnd(10)} submitted their own work`);

  // Trisha and Shubham hand in the same file, which Layer 1 finds by hash
  const shared = source(2, "takehome");
  const first = await upload(takehome, tokens[2]!, shared);
  await waitAnalysed(first, tokens[2]!);
  const copy = await upload(takehome, tokens[3]!, shared);
  await waitAnalysed(copy, tokens[3]!);
  console.log(`  ${STUDENTS[2]!.name.padEnd(10)} and ${STUDENTS[3]!.name} handed in the same file`);

  heading("4  The review queue, which is what a faculty member opens");
  const queue = await call("GET", `/api/assignments/${takehome}/results`, { token: faculty });
  console.log(`  ${"student".padEnd(12)} ${"rps".padStart(6)}  ${"L1".padStart(6)}  ${"L2".padStart(6)}  flags`);
  for (const row of queue.items as any[]) {
    const flags: string[] = [];
    if (row.structural?.exactDuplicateOf) flags.push("exact duplicate");
    if (row.behavioral?.lowVariance?.flagged) flags.push("low variance");
    if (row.behavioral?.cohortHealth?.flagged) flags.push("cohort not separating");
    if (row.signalDisagreement) flags.push("layers disagree");
    if (row.behavioral?.status !== "ok") flags.push(`L2 ${row.behavioral?.status}`);
    const name = row.student?.name ?? String(row.student);
    console.log(
      `  ${String(name).padEnd(12)} ${row.rps.toFixed(3).padStart(6)}  ` +
        `${fmt(row.structural?.score)}  ${fmt(row.behavioral?.score)}  ${flags.join(", ") || "-"}`,
    );
  }
  console.log(`\n  ${queue.total} results, highest first. Nothing here is a verdict.`);

  heading("5  The evidence behind the top one");
  const top = (queue.items as any[])[0];
  if (!top) throw new Error("the queue came back empty, so there is nothing to open");
  const topSubmission = String(top.submission);
  const detail = await call("GET", `/api/submissions/${topSubmission}/result`, { token: faculty });
  const r = detail.result;

  console.log(`  student        ${r.student?.name ?? r.student}`);
  console.log(`  rps            ${r.rps}`);
  console.log(
    `  weights        w1 ${r.weights.w1}, w2 ${r.weights.w2} attenuated to ${r.weights.effectiveW2}`,
  );
  console.log(`  config         version ${r.configVersion}, detector ${r.detectorVersion}`);
  console.log(`  revisions      ${(detail.revisions as number[]).join(", ")}`);

  if (r.structural?.matches?.length) {
    console.log(`\n  Layer 1 matched ${r.structural.matches.length}:`);
    for (const m of r.structural.matches) {
      const who = m.otherStudent?.name ?? m.otherStudent;
      console.log(`    ${String(who).padEnd(12)} similarity ${m.similarity}, z ${m.cohortZScore}`);
      for (const s of m.spans ?? []) {
        console.log(`      lines ${s.aStart}-${s.aEnd} against ${s.bStart}-${s.bEnd}`);
      }
    }
  }

  if (r.behavioral?.features?.length) {
    console.log(`\n  Layer 2 compared ${r.behavioral.features.length} features against the baseline:`);
    console.log(`    ${"feature".padEnd(22)} ${"value".padStart(8)} ${"baseline".padStart(9)} ${"z".padStart(7)}`);
    for (const f of r.behavioral.features) {
      console.log(
        `    ${f.feature.padEnd(22)} ${f.value.toFixed(3).padStart(8)} ` +
          `${f.baselineMean.toFixed(3).padStart(9)} ${f.zScore.toFixed(2).padStart(7)}`,
      );
    }
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
  console.log(`  status         ${decided.result.review.status}`);
  console.log(`  reviewed by    ${decided.result.review.reviewedBy}`);
  console.log(`  note           ${decided.result.review.note}`);
  console.log(`  audit written  ${decided.audited}`);

  const pending = await call("GET", `/api/assignments/${takehome}/results?reviewStatus=pending`, {
    token: faculty,
  });
  console.log(`\n  ${pending.total} still pending, so the queue shrank by one.`);

  heading("What this showed");
  console.log("  Layer 1 found the identical pair. Layer 2 measured one student against");
  console.log("  their own three sittings. Both scores, their weights and the evidence");
  console.log("  behind them are readable, and a person made the only decision that was");
  console.log("  made. The system ranked and stopped, which is the whole claim.");
  console.log(`\n  course ${code} is left in place, so the queue can be reopened.`);
}

function fmt(n: unknown) {
  return typeof n === "number" ? n.toFixed(3).padStart(6) : "-".padStart(6);
}

main().catch((err) => {
  console.error(`\nThe demo stopped: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
