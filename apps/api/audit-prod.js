/**
 * The production dependency gate.
 *
 * Plain `npm audit --audit-level=high` cannot ignore a single advisory, so one
 * unfixable transitive problem either blocks every push or forces the whole
 * threshold down to critical. Neither is honest. This runs the same audit and
 * fails on every high or critical advisory except the ones written down in
 * audit-allow.json with a reason and a date.
 *
 * The unit is the advisory, not the package, so a package that is only flagged
 * because of an allowed advisory passes, and the same package flagged for a new
 * reason still fails.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BLOCKING = new Set(["high", "critical"]);

function runAudit() {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    // npm exits non-zero whenever it finds anything, so the report is on
    // stdout even when the command "failed". Only a missing report is fatal.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

const allow = JSON.parse(readFileSync(new URL("./audit-allow.json", import.meta.url)));
const allowed = new Map(allow.allowed.map((a) => [a.id, a]));

const report = JSON.parse(runAudit());
const found = new Map();

// Walk every advisory object reachable through the via chains. A string entry
// in `via` names another package, not an advisory, so it is skipped.
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object" || !via.url) continue;
    const id = via.url.split("/").pop();
    if (!found.has(id)) found.set(id, { id, severity: via.severity, title: via.title, package: via.name });
  }
}

const blocking = [...found.values()].filter((a) => BLOCKING.has(a.severity));
const unallowed = blocking.filter((a) => !allowed.has(a.id));
const used = blocking.filter((a) => allowed.has(a.id));

for (const a of used) {
  const entry = allowed.get(a.id);
  console.log(`allowed  ${a.id}  ${a.package}  (${a.severity}, checked ${entry.checked})`);
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
