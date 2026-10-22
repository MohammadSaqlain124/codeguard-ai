# CodeGuard AI — project status

Written 22 October 2026, Day 34, at 103 numbered files in `docs/PROJECT_NOTES.md`.
Every figure here was read out of the repository on that date, not recalled.

---

## 1. What the project is

A code plagiarism detector for programming coursework that is built as an
**evidence system, not a verdict machine**. It ranks submissions by how much
they warrant a human look, and shows the reasoning that produced the ranking.
It never decides that somebody cheated. A faculty member does that, and the
system records who decided what, when, and why.

The headline output is the **RPS — relevance and provenance score**, composed
from detection layers that each answer a different question.

---

## 2. Architecture — three tiers plus infrastructure

| tier | path | runtime | what it does |
|---|---|---|---|
| API | `apps/api` | Node 22 / TypeScript | auth, storage, orchestration, review workflow, Layer 2 |
| Detector | `apps/detector` | Python / FastAPI | parsing, normalisation, Layer 1 structural comparison |
| Web | `apps/web` | React 19 / Vite | faculty review queue and evidence screen |

Infrastructure, all in `infra/docker-compose.yml`: **MongoDB 7** (data),
**Redis 7** (BullMQ job queue), **MinIO** (submitted source files), plus the
api, detector and worker containers.

---

## 3. The detection layers

### Layer 1 — structural (AST similarity)

Answers *"is this the same code as somebody else's?"* Lives entirely in the
Python detector.

| file | job |
|---|---|
| `app/parsing.py` | tree-sitter parse to a syntax tree, Python and Java |
| `app/normalise.py` | strip identifiers, numbers and string contents, so renaming variables and changing constants do not move the score |
| `app/units.py` | split a file into comparable units (functions, classes) |
| `app/prefilter.py` | choose which candidate pairs are worth the expensive comparison |
| `app/similarity.py` | APTED tree edit distance, converted to a similarity |
| `app/features.py` | the ten stylometric features, served to the API for Layer 2 |
| `app/main.py` | FastAPI app: `/health`, `/analyze`, `/features`, shared-secret auth, body-size limit |

The layer's score is the **highest similarity** against any candidate
considered. Exact duplicates are found by content hash, not by the similarity
score, and are reported separately.

### Layer 2 — behavioural (stylometry)

Answers *"does this look like how this student usually writes?"* — which is
the only layer that can see outsourced work with no second copy anywhere.
Lives in the API.

| file | job |
|---|---|
| `services/anchors.ts` | which submissions are trustworthy enough to describe a student's style |
| `services/baseline.ts` | builds the per-student, per-language baseline from anchors |
| `services/behavioural.ts` | z-scores the submission against that baseline; the layer's scoring logic |
| `services/recalibrate.ts` | refreshes cohort statistics when an assignment's population changes |

Ten features: `avg_line_length`, `blank_line_ratio`, `comment_density`,
`avg_identifier_length`, `underscore_identifier_ratio`, `avg_function_lines`,
`functions_per_100_lines`, `max_block_depth`, `avg_params_per_function`,
`for_loop_ratio`.

Score = `min(1, rootMeanSquare(zScores) / Z_SATURATION)` with `Z_SATURATION = 3`.

**Measured against the student's own past work, never against the cohort.**
That is the design claim the report defends.

### Layer 3 — AI-generated content

**Dropped, deliberately, and recorded rather than hidden.** Every result stores
`aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" }`.
The report must state this as a scope decision with its reasoning, not leave it
as an unexplained gap in the architecture.

### Composing the score

```
RPS = (w1 * structural + effectiveW2 * behavioural) / activeWeight
```

Renormalised over the layers that actually ran. **The configured weights
0.4 / 0.3 / 0.3 are therefore never the applied ones** — with Layer 3 absent
they become 0.571 / 0.429, and `effectiveW2` is reduced further when a thin
baseline attenuates it. An absent layer contributes nothing rather than
contributing a zero, because zero is a finding and an absent layer has made no
finding.

`services/detection.ts` does this composition and stores, on every result, the
weights and the review threshold that produced it — so a result stays readable
after the configuration changes.

---

## 4. Baseline integrity

Layer 2's weakness is that a student's baseline can be wrong, and a wrong
baseline accuses an honest student. Five mitigations exist for this, and they
are a genuine contribution of the project rather than boilerplate:

1. **Anchor provenance** — only invigilated work, or work a student nominates
   and faculty accept, can describe their style.
2. **Minimum anchor count** — below `minAnchorsForBaseline` (3) the layer
   declines to score rather than guessing.
3. **Baseline confidence** — a thin or inconsistent baseline attenuates the
   layer's weight (`effectiveW2`) instead of being trusted at full strength.
4. **Low-variance flag** — a student whose own work varies less than the
   cohort's is penalised by z-scoring, and the result says so.
5. **Cohort saturation flag** — when the pooled spread collapses, every z-score
   is a real difference divided by an invented floor, and the layer has stopped
   discriminating. The result says that too.

---

## 5. The API surface — 31 routes

**Auth and users** (`routes/authRoutes.ts`) — 7
`POST /register` · `POST /login` · `POST /refresh` · `POST /logout` ·
`GET /me` · `POST /users` · `PATCH /users/:userId`

**Courses and configuration** (`routes/courseRoutes.ts`) — 8
`GET /` · `GET /:courseId` · `POST /` · `PATCH /:courseId` ·
`POST /:courseId/students` · `POST /:courseId/students/remove` ·
`GET /:courseId/config` · `PATCH /:courseId/config`

**Assignments** (`routes/assignmentRoutes.ts`) — 5
`GET /` · `POST /` · `GET /:assignmentId` · `PATCH /:assignmentId` ·
`GET /:assignmentId/results` (the ranked review queue)

**Submissions and results** (`routes/submissionRoutes.ts`) — 11
`POST /` (upload) · `GET /` · `GET /:submissionId` · `GET /:submissionId/file` ·
`GET /:submissionId/result` · `GET /:submissionId/student-view` ·
`PATCH /:submissionId/explanation` · `PATCH /:submissionId/review` ·
`POST /:submissionId/nominate` · `DELETE /:submissionId/nominate` ·
`POST /:submissionId/rerun`

**Detector** (`app/main.py`) — 3
`GET /health` · `POST /analyze` · `POST /features`

---

## 6. Data model — 8 Mongoose models

| model | holds |
|---|---|
| `User` | accounts and roles: admin, faculty, student |
| `Course` | a course and its enrolment |
| `Assignment` | an assignment, its language, and its provenance (invigilated or take-home) |
| `Submission` | an uploaded file, its hash, its status |
| `DetectionResult` | the score, both layers' evidence, the applied weights and threshold, the review |
| `DetectionConfig` | per-course weights and thresholds, with per-language overrides |
| `BaselineProfile` | a student's style baseline, per language |
| `AuditLog` | every state change that affects a student's record |

`models/plugins.ts` carries the shared `serialize` plugin, which is what makes
`id` appear on every document the API returns.

---

## 7. Supporting machinery

- **Queue** (`queue/detectionQueue.ts`, `worker.ts`) — BullMQ over Redis, three
  job types: analyse, recalibrate, rebuild-baseline. Debounced by job id so
  sixty uploads at a deadline collapse into a handful of runs.
- **Storage** (`storage/minio.ts`) — submitted files live in an object store,
  never in the database.
- **Auth** (`utils/jwt.ts`, `middleware/auth.ts`) — access and refresh tokens,
  role guards, active-user checks.
- **Validation** (`validation/*.ts`) — every request body, query and parameter
  validated with zod before a controller sees it.
- **Audit** (`services/audit.ts`) — `AUDIT_ACTIONS` is the list of state changes
  the system claims to record, and every entry in it has exactly one emitter.
- **Access control** (`services/access.ts`) — who may see which course, which
  assignment, which result.
- **Errors and logging** (`utils/AppError.ts`, `middleware/errorHandler.ts`,
  `config/logger.ts`) — pino with a redaction list, so no secret is ever logged.

---

## 8. The web interface — 4 pages

| page | what it does |
|---|---|
| `pages/LoginPage.tsx` | sign in |
| `pages/CoursesPage.tsx` | courses and their assignments |
| `pages/QueuePage.tsx` | the ranked review queue, filtered by review status, paged |
| `pages/EvidencePage.tsx` | the evidence screen — the project's whole argument on one page |

The evidence page shows the RPS **as the arithmetic that produced it**: each
layer's weight, score and product, their total, and one division. Every
similarity carries its cohort z-score. Every feature shows the value, the
student's usual, their spread and the z, each to the precision needed to check
the z by hand. Everything that weakens the number renders with it, not beneath
it.

---

## 9. Libraries used

**API — runtime:** express 5.2.1 · mongoose 9.10 · zod 4.5.4 · bullmq 6.3.8 ·
ioredis 6 · minio 8.0.7 · multer 2.4 · bcrypt 6 · jsonwebtoken 9.0.3 ·
helmet 8.3 · cors 2.8.6 · pino 10.3.1 · pino-http 11

**API — development:** typescript 7.0.2 · vitest 5 · supertest 7.2.2 ·
tsx 4.23.13 · pino-pretty 13.1.3

**Detector — runtime:** fastapi 0.141.1 · uvicorn[standard] 0.52.4 ·
pydantic 2.13.5 · tree-sitter 0.26.0 · tree-sitter-python 0.25.0 ·
tree-sitter-java 0.23.5 · apted 1.0.3

**Detector — development:** pytest 9.1.1 · httpx 0.28.1 · ruff 0.16.6

**Web:** react 19.2.0 · react-dom 19.2.0 · react-router-dom 7.18.4 ·
vite 7.3.7 · @vitejs/plugin-react 5.0.4 · typescript 7.0.2

**Infrastructure:** MongoDB 7 · Redis 7-alpine · MinIO · Docker Compose

Every detector dependency is **pinned to an exact version**, because
`DETECTOR_VERSION` is stored on each result to make old results explainable,
and a floating tree-sitter grammar would silently change every similarity under
an unchanged version string.

---

## 10. What has actually been achieved

These are the parts that distinguish the project from a working CRUD app.

1. **Two reproducible authorship measurements**, committed as scripts sharing
   one module (`measurements/common.py`), so "the same method applied to both
   languages" is literally the same code. Java: 123 files, 15 authors, 11
   repositories. Python: 204 files, 27 authors, 15 repositories. Zero parse
   failures in 327 files. Reported as a sampling range across 25 draws, not as
   a point estimate.

2. **Layer 1's structural floor measured** across 15 Python repositories — 1,989
   candidate files, 466 single-author, 204 selected, 100 pairs per category at a
   fixed seed under production comparison settings.

3. **Mutation testing** on the detector suite: 19 deliberate mutations, all
   caught; two were *not* caught first time, and finding that exposed a dead
   code path and a missing sort test. Very few undergraduate projects contain
   anything like this.

4. **Five retracted claims, recorded rather than hidden.** The engineering log
   is a validation record: it shows which figures were wrong, how that was
   found, and what changed. The draws mechanism exists *because* a single
   sample proved unreliable.

5. **An evidence screen that found nine defects the test suite did not** — four
   on 17 October, five on 18 October — including an arithmetic column that did
   not sum to its own headline, and a review form that opened on a verdict.
   That is a testing-methodology finding, not a frontend anecdote.

6. **The audit log audited against its own vocabulary**, which found four gaps
   no test could have caught, because a test asserts what the code does and
   this asked what the code claims.

7. **A CI gate and pre-push hooks** — typecheck, ruff, pytest, production
   dependency audit.

**Tests: 155 in the API, 123 in the detector — 278 total.**

---

## 11. What is still left

### Backend — small, and mostly correctness rather than missing features

- **`eligibilityFor` compares a stored score to a live threshold.**
  `services/anchors.ts` line 138 reads `result.rps >= config.reviewThreshold`,
  where `result.rps` was computed under whatever threshold applied then. Since
  20 October the result carries its own `reviewThreshold`, so this is now a
  one-line fix. **This is the clearest remaining backend bug.**
- **`signalDisagreement` fires on boundary artefacts.** It is a side-of-the-line
  test, so it fires identically on 1.000 against 0.330 and on 0.470 against
  0.520. The page no longer overclaims, but the flag is unchanged. Fixing it
  needs a margin, and that margin is an unmeasured number.
- **The test suite has not run since the schema change of 20 October.** That
  change went in on a typecheck alone.
- **Finding 3 is still unflagged**, and the Layer 1 / Layer 2 independence
  question is still open.

### Frontend — the APIs exist, the screens do not

- Student: submit a file, see my own result, answer a flagged result.
- Admin: courses, enrolment, and the detection configuration editor. The
  configuration endpoints have existed since 15 October with no UI at all.

### Report — this is the real risk, not the code

- **Chapter 2, the literature survey, is unwritten.** Nothing in the repository
  substitutes for it.
- **No diagrams exist of any kind** — no component, ER, sequence or data-flow
  diagram. These are also the figures a viva is conducted from.
- **13 references collected, every one carrying a TODO** for a field that could
  not yet be confirmed.
- **No SRS document exists.** The requirements have to be written out rather
  than inferred from the schema.
- Chapters 4 and 5 are largely drafted already inside Files 096–103 of
  `PROJECT_NOTES.md` and need selecting and rewriting rather than researching.

### Documentation

- The **File Book** is 18 entries behind, blocked on a convention question: the
  engineering log stopped carrying a per-file `Files:` line at File 087 when
  entries became one per working session.
- The **Reference Notebook** is current to Day 32, including a **106-row viva
  cram sheet** — one question and one defensible answer each.

---

## 12. For the viva

`docs/notebook/CodeGuard_AI_Reference_Notebook.docx`, section **§6 Viva Cram
Sheet**, holds 106 question-and-answer pairs covering every defensible decision
in the project. It is the single most useful document to read before being
questioned on this work.
