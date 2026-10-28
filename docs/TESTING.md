# Running the tests

Written 27 October 2026, Day 37, from `apps/api/package.json`, `apps/api/tests/helpers.ts`
and `infra/docker-compose.yml`. Every claim here was read out of the repository,
not recalled.

**278 tests: 155 in the API (vitest), 123 in the detector (pytest).**

**CI does not run the API suite.** The workflow has three jobs — API typecheck,
Detector lint and tests, Web typecheck — and none of them runs vitest. The gate
covers 123 of the 278. Running the API suite is a manual step until service
containers are added to `ci.yml`. See File 105.

---

## The short version

Windows PowerShell, once, to bring the infrastructure up:

```
cd E:\Projects\CodeGuard_AI\infra
docker compose up -d
docker compose ps
```

VS Code terminal, for the API suite:

```
cd E:\Projects\CodeGuard_AI\apps\api
npm test
```

That is the whole thing. `npm test` is enough on its own, for two reasons given
below that are easy to get wrong if you run vitest directly.

---

## Why `npm test` and not `npx vitest run`

```json
"typecheck": "tsc -p tsconfig.test.json",
"pretest":   "npm run typecheck",
"test":      "vitest run --no-file-parallelism"
```

Two things come free with `npm test` and are lost by calling vitest yourself:

1. **`pretest` typechecks first.** npm runs it automatically. A contract that has
   drifted is caught in seconds, before any container is touched.
2. **`--no-file-parallelism`.** Every test file connects to the *same*
   `codeguard_test` database and clears collections between tests. Run the files
   in parallel and they delete each other's fixtures mid-run. The failures that
   produces are real-looking and completely fictional, and they move around
   between runs, which is the worst kind of red to debug.

If you ever do need to run one file, keep the flag:

```
cd E:\Projects\CodeGuard_AI\apps\api
npx vitest run --no-file-parallelism tests/layer2.test.ts
```

---

## The working-directory trap

`tests/helpers.ts`:

```ts
if (existsSync("../../infra/.env")) process.loadEnvFile("../../infra/.env");
process.env.MONGO_URI = (process.env.MONGO_URI ?? "").replace("/codeguard?", `/${TEST_DB}?`);
...
if (!process.env.MONGO_URI.includes(`/${TEST_DB}?`)) {
  throw new Error(`Refusing to run: tests must use the ${TEST_DB} database`);
}
```

That path is **relative to the working directory**. Run the suite from the
repository root and `.env` never loads, `MONGO_URI` is the empty string, and
every file dies on:

```
Refusing to run: tests must use the codeguard_test database
```

That is the guard working, not 155 real failures. **Always run from `apps/api`.**

The guard itself is worth keeping as it is. It is the thing standing between a
mistyped URI and `vitest` clearing the development database.

---

## What has to be running, and what does not

**Needed:** MongoDB, Redis, MinIO — the three data services in
`infra/docker-compose.yml`.

**Not needed: the detector container.** `helpers.ts` overrides `DETECTOR_URL`
to `http://127.0.0.1:8099` *after* loading `.env`, with the comment "so the real
detector can never be reached". The API suite runs against a stub on that port.
A detector that is down, rebuilding, or on a different version cannot make the
API suite red.

**Not needed: `SEED_PASSWORD`.** The seed script requires it, but the suite never
calls the seed script. `seedCourse()` in `config.test.ts` is a local helper that
happens to share the word.

---

## The detector suite

```
cd E:\Projects\CodeGuard_AI\apps\detector
.\.venv\Scripts\Activate.ps1
pytest -q
```

**The virtual environment lives in `apps/detector/.venv`, not at the repository
root.** Activating from the root fails with "not recognized as the name of a
cmdlet", which looks alarming and means only that the path is wrong.

Needs no Docker and no database. It is pure Python and the fastest useful signal
in the project.

Two deprecation warnings are expected and are not failures. One is starlette
telling us `httpx` with its test client is deprecated in favour of `httpx2`; the
detector pins `httpx 0.28.1`, so a future starlette upgrade will need that
addressed. The other is raised inside starlette itself and is not ours.

---

## State as of this document

**Detector suite: 123 passed, 28 October, in 2.7 seconds.** The whole Layer 1
tier — parsing, normalisation, tree edit distance, the prefilter, unit matching,
the style features and both HTTP endpoints — is green. Whatever the API suite
turns up, it is not there.

**API suite: still not run since the schema change of 20 October.** That change
went in on a typecheck alone, and so did everything after it.

Scoped on 26 October by reading the tests against the source rather than running
them:

- No test file has been touched since **17 October**.
- `services/detection.ts` changed on the **20th**, `services/anchors.ts` on the
  **22nd**. Those two carry the risk.
- **The reason strings rewritten in `anchors.ts` are not a risk.** The suite
  asserts status codes and database state, not message text. There are no
  exact-string assertions on eligibility reasons.
- **The four fields `detection.test.ts` asserts on a stored result** —
  `weights.w1`, `weights.w2`, `reviewThreshold`, `configVersion` — are all still
  written by `detection.ts`.

That is a reasoned expectation and nothing more. Reading contracts is not
executing them, and the run is the only evidence that counts.

---

## If it goes red

Work in this order, because it moves from cheapest to most expensive:

1. **Read the first failure, not the last.** With `--no-file-parallelism` the
   files run in order, and a broken fixture in an early file cascades.
2. **Check the error is not the database guard** (see above). That one is
   a working-directory mistake, not a test failure.
3. **Check Docker is actually up**, not just started: `docker compose ps` in
   `infra` should show the services healthy, not restarting.
4. **Run the detector suite separately.** It needs none of the above, so if it is
   also red the cause is in Python and unrelated.
5. Only then look at `detection.ts` and `anchors.ts`, which is where the drift
   since 17 October lives.
