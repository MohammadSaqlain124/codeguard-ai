# Chapter 6 — Testing and Verification

> **Draft status, 04 November 2026.** Figures read from `docs/TESTING.md`,
> `apps/api/package.json`, `apps/api/tests/helpers.ts`, `.github/workflows/ci.yml`
> and `docs/PROJECT_NOTES.md`. Re-run the suite and confirm the counts before
> submission; a test count quoted wrongly is the easiest thing for an examiner
> to check.

---

## 6.1 What is tested, and what that number means

**278 automated tests: 155 in the API under vitest, 123 in the detector under
pytest.**

The split is not arbitrary. The detector suite covers the whole structural tier
— parsing, normalisation, tree edit distance, the prefilter, unit matching, the
style-feature extraction and both HTTP endpoints — and needs no database, no
object store and no Docker. It runs in under three seconds and is the fastest
useful signal in the project. The API suite covers authentication, courses,
submissions, results, the configuration resolver, Layer 2 and the re-run path,
and needs MongoDB, Redis and the object store running.

A count on its own is close to meaningless, so the rest of this chapter is about
what the suite is constructed to prevent rather than how much of it there is.

## 6.2 Three design decisions in the test harness

These are worth a chapter section because each one exists in response to a
specific way the suite could have produced false results.

### 6.2.1 A guard that refuses to run against the development database

`tests/helpers.ts` rewrites the Mongo URI to point at `codeguard_test`, and then
refuses to proceed if the rewrite did not take effect:

```ts
process.env.MONGO_URI = (process.env.MONGO_URI ?? "").replace("/codeguard?", `/${TEST_DB}?`);
if (!process.env.MONGO_URI.includes(`/${TEST_DB}?`)) {
  throw new Error(`Refusing to run: tests must use the ${TEST_DB} database`);
}
```

The suite clears collections between tests. Without this guard, a mistyped or
unset URI would point that clearing at the development database. The guard is
the thing standing between a typo and the loss of every fixture, course and
submission in local development.

It has a consequence worth knowing: the `.env` path is **relative to the working
directory**, so running the suite from the repository root loads nothing,
leaves `MONGO_URI` empty, and produces 155 identical failures on that error
message. **That is the guard working, not 155 real failures** — a distinction
that costs a quarter of an hour the first time it happens.

### 6.2.2 Serial execution, because the files share one database

```json
"test": "vitest run --no-file-parallelism"
```

Every test file connects to the same database and clears collections between
tests. Run the files in parallel and they delete each other's fixtures
mid-run. The failures that produces are real-looking, entirely fictional, and
move around between runs — the worst category of red to debug, because it
punishes the correct instinct of re-running to confirm.

`npm test` also runs `pretest`, which typechecks first, so a drifted contract is
caught in seconds before any container is touched. Calling `vitest` directly
loses both properties, which is why the project's documentation specifies
`npm test` rather than the tool underneath it.

### 6.2.3 The detector is stubbed, deliberately

`helpers.ts` overrides `DETECTOR_URL` to a stub port *after* loading the
environment, with the comment "so the real detector can never be reached". A
detector that is down, mid-rebuild or on a different version therefore cannot
make the API suite red.

This is a deliberate trade. The API suite tests the API's own behaviour,
including how it handles what the detector returns, and isolating it means a
red API suite always indicates an API defect. The cost is that no automated
test exercises the two services together; that gap is stated in §6.6.

## 6.3 Mutation testing

This is the strongest verification evidence in the project and the part most
likely to be asked about.

A passing suite demonstrates that the tests agree with the code. It does not
demonstrate that the tests would notice if the code were wrong. Mutation testing
asks the second question directly: deliberately break the implementation in a
small, plausible way, and check that at least one test fails.

**Nineteen deliberate mutations were introduced across the detector suite.
Seventeen were caught immediately. Two were not**, and those two are the
valuable ones:

- One survived because it mutated a code path **no test reached** — a dead
  branch the suite had never exercised and the coverage figure had not revealed
  as untested in any way that prompted action.
- One survived because the suite asserted the *contents* of a result but never
  its **ordering**, so reversing a sort changed nothing any assertion looked at.

Both gaps were then closed. The finding to report is not "19 of 19 eventually
caught" but that **a suite can be green, substantial and still blind in a
specific direction**, and that mutation testing is what makes that blindness
visible. Very few undergraduate projects contain this, and it directly answers
the question *how do you know your tests are any good?*

## 6.4 Continuous integration, and a gate that was not shut

The CI workflow runs on every push and pull request against `main`, with four
jobs: API typecheck and production-dependency audit, **API tests**, detector
lint and tests, and web typecheck.

**The API tests job did not exist until 01 November 2026, and the honest account
of that belongs in the report.** For most of the project the workflow had three
jobs — API typecheck, detector lint and tests, web typecheck — and none of them
ran vitest. The gate therefore covered 123 of 278 tests, and every green badge
meant *the types check and the detector passes* while being read as *the tests
pass*.

A badge that means less than it appears to is worse than no badge, because it is
trusted. The gap was found while investigating an unrelated red badge, which is
its own small lesson: the failure was interesting, and what it revealed was more
interesting.

Closing it required MongoDB and Redis as service containers with health checks,
and the object store started as a `docker run` step rather than a service —
because an Actions service container cannot be given a command, and the object
store needs one. The stated reason for not doing it earlier had been that it
would require putting credentials into GitHub secrets; two thirds of that
reasoning was wrong. `helpers.ts` loads the environment file only
`if (existsSync(...))`, so a missing file is not an error and the workflow can
supply the environment itself, and because every container is destroyed with the
runner, nothing it holds is a credential worth protecting.

### 6.4.1 The dependency audit as a gate

`npm run audit:prod` fails the build on a high or critical advisory against a
production dependency. It is advisory-aware: a small allow-list records
specific advisory identifiers with a written reason and a date, so a known and
assessed issue does not block every subsequent push while an unassessed one
still does.

One episode is worth recording because it is a general lesson about fixing
advisories. A transitive dependency had a published advisory whose patched
versions were all ESM-only, while the consuming package is CommonJS and calls
the export directly. Applying the "fix" would have replaced a working function
export with a module object and broken the object-store client at runtime —
a security patch that would have taken down file uploads. **The advisory was
real, the patch was real, and applying it would have been wrong.** It was caught
by comparing the exported shapes rather than by trusting the version number.

## 6.5 A verification method the suite does not cover

Three classes of defect in this project were found by methods other than running
tests, and the counts are worth stating because they argue for keeping those
methods rather than replacing them with more tests.

**Rendering real data through a screen and reading it.** Nine defects were found
this way across two days of frontend work, and more later. They included a CSS
custom property that did not exist — a bad `var()` fails silently, so the colour
simply came out wrong — a label describing a cohort statistic as belonging to
the student, and two distinct meanings sharing one visual language.

**Printing the result to paper.** Two further defects, including a background
wash that appeared on every printed page and came from a container whose padding
had been reset for print but whose background had not.

**Reading the code rather than executing it.** Four defects in the ablation
study, described in Chapter 7 §7.2. Each had produced output that looked like a
result: a positive control that compared the wrong file, a chance baseline that
inflated every figure, a measurement of a comparison strategy the system does
not deploy, and a significance verdict printed without its direction.

What these have in common is that **a test asserts a value, and every one of
these was a thing nobody had thought to assert.** They are not an argument
against automated testing; they are an argument that a suite's coverage is
bounded by its author's imagination, and that rendering, printing and reading
are the cheap ways to exceed it.

## 6.6 Limitations of the verification

Stated here rather than left for an examiner to find.

1. **No end-to-end test exercises the API and detector together.** The detector
   is stubbed in the API suite by design (§6.2.3), so the integration between
   the two services is verified manually and by the seeded demonstration script.
2. **No automated frontend tests.** The web interface is verified by rendering
   and inspection, which §6.5 shows is effective at finding a particular class
   of defect and is not a substitute for regression tests.
3. **Mutation testing covers the detector only.** The API suite has not been
   subjected to it, so the equivalent blind spots there are unknown rather than
   absent.
4. **The API suite takes several minutes**, dominated by password hashing. One
   test signs in eight times at roughly half a second of bcrypt each, which left
   it one slow machine away from a spurious timeout until it was given its own
   budget. Slow suites get run less often, and that is a verification risk
   rather than an inconvenience.
5. **Coverage percentage is not reported.** It was not treated as a goal, on the
   grounds that mutation testing answers the question coverage is usually used
   as a proxy for. An examiner may still ask for the number.
