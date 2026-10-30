/**
 * The production dependency gate.
 *
 * Plain `npm audit --audit-level=high` cannot ignore a single advisory, so one
 * unfixable transitive problem either blocks every push or forces the whole
 * threshold down to critical. Neither is honest. This reads npm's own JSON
 * report and fails on every high or critical advisory except the ones written
 * down in audit-allow.json with a reason and a date.
 *
 * The unit is the advisory, not the package, so a package flagged only because
 * of an allowed advisory passes, and the same package flagged for a new reason
 * still fails.
 *
 * It reads the report on stdin rather than running npm itself. An earlier
 * version shelled out with execFileSync("npm", ...), which works on Linux and
 * fails on Windows, where npm is npm.cmd and execFile does not use a shell.
 * A pipe is handled by both cmd.exe and sh, and in both the pipeline's exit
 * code is the last command's, which is this script.
 */
import { readFileSync } from "node:fs";

const BLOCKING = new Set(["high", "critical"]);

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const raw = readStdin().trim();
if (raw === "") {
  console.error("No audit report on stdin. Run this through `npm run audit:prod`,");
  console.error("which pipes `npm audit --omit=dev --json` into it.");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error("The audit report on stdin was not JSON. First 200 characters:");
  console.error(raw.slice(0, 200));
  process.exit(1);
}

const allow = JSON.parse(readFileSync(new URL("./audit-allow.json", import.meta.url), "utf8"));
const allowed = new Map(allow.allowed.map((a) => [a.id, a]));

// Walk every advisory object reachable through the via chains. A string entry
// in `via` names another package rather than an advisory, so it is skipped.
const found = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object" || !via.url) continue;
    const id = via.url.split("/").pop();
    if (!found.has(id)) {
      found.set(id, { id, severity: via.severity, title: via.title, package: via.name });
    }
  }
}

const blocking = [...found.values()].filter((a) => BLOCKING.has(a.severity));
const unallowed = blocking.filter((a) => !allowed.has(a.id));
const used = blocking.filter((a) => allowed.has(a.id));

for (const a of used) {
  console.log(`allowed  ${a.id}  ${a.package}  (${a.severity}, checked ${allowed.get(a.id).checked})`);
}

// An entry nobody needs any more is worth removing, so say so rather than
// letting the file collect exceptions that no longer apply.
for (const [id, entry] of allowed) {
  if (!found.has(id)) console.log(`stale    ${id}  ${entry.package}  no longer reported, remove it`);
}

if (unallowed.length === 0) {
  console.log(`\nproduction audit ok: ${used.length} allowed, 0 unallowed high or critical`);
  process.exit(0);
}

console.error(`\n${unallowed.length} high or critical advisory not allowed:\n`);
for (const a of unallowed) {
  console.error(`  ${a.id}  ${a.package}  (${a.severity})`);
  console.error(`    ${a.title}`);
}
console.error("\nFix it, or add it to audit-allow.json with a reason and today's date.");
process.exit(1);
