# CodeGuard AI — project status

Written 22 October 2026, Day 34. **Revised 27 October 2026, Day 37**, at 104
numbered files in `docs/PROJECT_NOTES.md`. Every figure here was read out of the
repository on one of those dates, not recalled.

The 27 October revision corrects two statements about Layer 2 in section 3 that
described a system this project does not have. See File 104.

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
| Web | `apps/web` | React 19 / Vite | sign in, two role dashboards, courses, upload, review queue, evidence, course management, admin accounts |

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

The detector extracts **ten** features: `avg_line_length`, `blank_line_ratio`,
`comment_density`, `avg_identifier_length`, `underscore_identifier_ratio`,
`avg_function_lines`, `functions_per_100_lines`, `max_block_depth`,
`avg_params_per_function`, `for_loop_ratio`. All ten are stored on the baseline.

**Four of them are scored.** `SCORED_FEATURES` in `services/behavioural.ts` is
`blank_line_ratio`, `avg_line_length`, `max_block_depth`, `comment_density`. All
ten stay stored on the baseline, so the choice is reversible.

**The justification for those four is retracted, and this document carried the
retracted version until 31 October.** The four were chosen on Day 19 from a
60-file sample. `apps/detector/measurements/README.md`, written 13 October on
**204 Python files from 15 repositories**, says plainly: *"Day 19's ranking does
not replicate on its own language."* Specifically:

- `blank_line_ratio`, which Day 19 ranked **first at 2.73** and which drove the
  choice of the four, ranks **ninth of ten at 1.08** in Python.
- The two naming features Day 19 ranked last at 0.17 and 0.18 rank **fourth and
  fifth**.
- **Nine of the ten** have a Python F ratio above 1, not four.
- Using every feature that applies **beats** the fixed four in both languages:
  Python **2.91x to 5.56x**, Java **2.80x to 3.88x**.

So the earlier sentence here — that the four were the ones above 1 and that
including the others cost accuracy — had it backwards. Day 19's script was
deleted, so the disagreement cannot be diagnosed directly; on every ground that
can be checked, the larger measurement supersedes it.

**A fixed four cannot be right for both languages.** `blank_line_ratio` carries
almost no author signal in Python (1.08) while doing real work in Java (3.34);
`comment_density` is the reverse in degree (13.97 against 2.49).

Whether `behavioural.ts` should score all applicable features instead is a live
decision, recorded as open in `docs/PROJECT_NOTES.md` and owned by the Layer 2
vertical. It is not decided here.

Score = `min(1, rootMeanSquare(zScores) / Z_SATURATION)` with `Z_SATURATION = 3`.

**The comparison is against the student's own past work. The units are the
cohort's.** In `behavioural.ts` the z-score is `(value - mean) / stdDev`, where
`mean` is the student's own, trust-weighted across their anchors, and `stdDev` is
`Math.max(cohortSpread, VARIANCE_FLOOR[feature])` — the cohort's spread, floored.
A z-score here means *how far this submission sits from this student's usual,
measured in units of how much students in this class differ from one another.*

The cohort denominator is a measured choice, not a convenience: a student's own
spread, taken from three or four anchors, is too unstable to divide by. **AUC
0.766 using the student's own spread, against 0.909 using the cohort's.** A
student's mean is personal; the spread is closer to a property of the feature.

**How well it works, stated the way the measurement states it.** Across eleven
within-project tests, *"the features reach roughly 1.4x to 2.5x where they work
at all, and they fail to beat chance in more than half the projects tested"* —
five of eleven hold, six do not. The strongest single result is sympy: nine
authors, 68 files, 2.51x, never below 2.12x across 25 draws. The weakest that
still matters is scikit-learn, seven authors and 54 files, which does not clear
chance at all — so sample size is not the whole story, and projects differ in
how much personal style survives their own conventions.

That is the sentence the report should carry about Layer 2's strength. It is
considerably more sober than any earlier figure in this document, and it is the
one that survives being checked.

**Lift is not comparable across runs with different author counts.** Lift is
accuracy over chance and chance is 1/k, so it rises with the number of authors
even when nothing about the features changed: the same Python data gives 2.43x
at 5 authors and 4.65x at 20. Any two figures quoted side by side must hold the
author count fixed.

Both halves are load-bearing, and that is the design claim the report defends.
An earlier version of this document said "never against the cohort", which is
false and does not survive an examiner opening the file. It also contradicted
mitigation 5 below, which exists precisely because the cohort denominator can
collapse.

**Cram sheet row 69 carries this answer; row 68 does not.** On 27 October this
document was corrected using the notebook as the source, and row 68 turned out
to carry the same retracted Day 19 figures corrected above. The notebook is not
a source either. `apps/detector/measurements/README.md` and the code are the
sources; the notebook and this file are both summaries of them, and both have
drifted at least once.

Row 69's figures for the cohort denominator — AUC 0.766 against 0.909 — are not
stated anywhere in the measurements folder. They are quoted here because row 69
is the only record of them, and **they should be traced to a run before the
report quotes them.**

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

## 5. The API surface — 32 routes

**Auth and users** (`routes/authRoutes.ts`) — 8
`POST /register` · `POST /login` · `POST /refresh` · `POST /logout` ·
`GET /me` · `GET /users` · `POST /users` · `PATCH /users/:userId`

`POST /register` is public and hardcodes `role: "student"`. `POST /users` is
admin-only, and choosing a role is the point of it. `GET /users` was added
26 October: admin-only, paged, filtered by role, active state and a search term.

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

## 8. The web interface — 10 pages, 5 components

| page | role | what it does |
|---|---|---|
| `pages/LoginPage.tsx` | public | sign in, sign up, switch account |
| `pages/StudentHome.tsx` | student | dashboard: what is submitted, what is still open |
| `pages/SubmitPage.tsx` | student | upload a file to an assignment |
| `pages/MyResultPage.tsx` | student | own submission status, any recorded decision, and the reply to it |
| `pages/FacultyHome.tsx` | staff | dashboard: what is waiting to be reviewed |
| `pages/CoursesPage.tsx` | all | courses and their assignments |
| `pages/ManagePage.tsx` | staff | create a course, enrol by roll number, create an assignment |
| `pages/QueuePage.tsx` | staff | the ranked review queue, filtered by review status, paged |
| `pages/EvidencePage.tsx` | staff | the evidence screen — the project's whole argument on one page |
| `pages/AdminPeople.tsx` | admin | create accounts, choose roles, deactivate with a recorded reason |

| component | what it does |
|---|---|
| `components/AppShell.tsx` | the frame: top bar, role-aware sidebar, outlet |
| `components/SpatialBackground.tsx` | the parallax field, still on the evidence page by design |
| `components/Avatars.tsx` | the student and teacher figures on sign in |
| `components/FingerprintRadar.tsx` | Layer 2's four scored features as a radar |
| `components/PrintHeader.tsx` | the identity block that exists only on paper |

**What a student is deliberately not shown.** `GET /submissions/:id/student-view`
returns the submission status and, only once a decision exists, the review. It
returns **no score of any kind**. A student who can read their own RPS can write
the next submission to lower it, and a ranking you can tune against stops
measuring what it claims to. `MyResultPage` says this on the page rather than
leaving the absence to be read as a bug.

The evidence page shows the RPS **as the arithmetic that produced it**: each
layer's weight, score and product, their total, and one division. Every
similarity carries its cohort z-score. Every feature shows the value, the
student's usual, the cohort spread and the z, each to the precision needed to
check the z by hand.

Since 26 October it also carries a **fingerprint radar** and **prints**. The
radar plots the four scored features, with the radius as the magnitude of z over
the saturation point and the direction printed beside each label; it recovers the
saturation constant as `rms(z) / score` rather than copying the backend's
constant, so it cannot silently stop matching the score. Printing goes through
the browser's own dialog, which is also how it becomes a PDF, so there is no
second renderer that can drift from the page. The printed sheet carries its own
identity block and its own caveats, because paper detached from the screen has no
URL and no sidebar.

**One known defect, carried from File 103.** The section headed "Read this before
the number" renders *after* the number and its arithmetic table. The printed PDF
makes it plain on page 1. Either `Caveats` moves above `ScoreBreakdown` or the
heading is renamed.

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

4. **Eight retracted claims, recorded rather than hidden.** The engineering log
   is a validation record: it shows which figures were wrong, how that was
   found, and what changed. The draws mechanism exists *because* a single
   sample proved unreliable.

   Three of the eight are corrections to *this document*. Two were made on
   27 October, where it had drifted from the code. The third, on 31 October,
   corrected one of those: the 27 October fix used the reference notebook as
   its source, and the notebook carried the same retracted Day 19 feature
   figures. A correction made against the wrong source is still wrong, and
   that is worth more to the report than a clean record would be.

5. **An evidence screen that found nine defects the test suite did not** — four
   on 17 October, five on 18 October — including an arithmetic column that did
   not sum to its own headline, and a review form that opened on a verdict.
   That is a testing-methodology finding, not a frontend anecdote.

6. **The audit log audited against its own vocabulary**, which found four gaps
   no test could have caught, because a test asserts what the code does and
   this asked what the code claims.

   The same method, applied to this document on 27 October, found that the
   stated feature count and the stated comparison basis for Layer 2 were both
   wrong — while the reference notebook had both right, with measurements. A
   test asserts what the code does; a screen shows what it produced. Neither can
   notice that one derived document has drifted from the sources it summarises.

7. **A CI gate and pre-push hooks** — typecheck, ruff, pytest, production
   dependency audit.

**Tests: 155 in the API, 123 in the detector — 278 total.**

---

## 11. What is still left

### Backend — small, and mostly correctness rather than missing features

- ~~**`eligibilityFor` compares a stored score to a live threshold.**~~ **Fixed
  22 October.** Eligibility is now judged against the threshold stored on the
  result, falling back to the current setting only when the result recorded none,
  and saying which it used. The earlier description of this as "the clearest
  remaining backend bug" and "a one-line fix" was wrong on both counts and is
  retracted in File 104: the rps does not depend on the threshold, and the real
  defect was a contradiction between what the page said and what the nomination
  refused.
- **`signalDisagreement` fires on boundary artefacts.** It is a side-of-the-line
  test, so it fires identically on 1.000 against 0.330 and on 0.470 against
  0.520. The page no longer overclaims, but the flag is unchanged. Fixing it
  needs a margin, and that margin is an unmeasured number.
- **The test suite has not run since the schema change of 20 October** — seven
  days as of this revision. That change went in on a typecheck alone. The
  exposure is narrower than it looks and was scoped on 26 October: no test file
  has been touched since 17 October, while `detection.ts` moved on the 20th and
  `anchors.ts` on the 22nd, but the suite asserts status codes and database state
  rather than message strings, so the reason strings rewritten in `anchors.ts`
  are not at risk, and the four fields `detection.test.ts` asserts on a stored
  result are all still written. **Running it is the next thing to do.**
  `tests/helpers.ts` loads `../../infra/.env` by a path relative to the working
  directory, so the suite must be run from `apps/api` or every file fails on the
  database guard. See `docs/TESTING.md`.
- **Finding 3 is still unflagged**, and the Layer 1 / Layer 2 independence
  question is still open.

### Frontend — built 20-26 October, one screen still missing

Done: sign in and sign up, two role-aware dashboards, course and assignment
management, enrolment by roll number, admin account creation with roles,
file upload, the student's own result view with a reply form, the fingerprint
radar, and print to PDF.

- **The detection configuration editor has no UI.** `GET`/`PATCH
  /courses/:courseId/config` have existed since 15 October and are still
  reachable only by hand. This is the last endpoint group with no screen.
- Queue and evidence inherited the new palette but have not been photographed
  since it changed.

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

- The **File Book** is 20 entries behind, blocked on a convention question: the
  engineering log stopped carrying a per-file `Files:` line at File 087 when
  entries became one per working session.
- The **Reference Notebook** is current to **Day 37**, including a **116-row
  viva cram sheet** — one question and one defensible answer each.
- **`docs/TESTING.md`** was added on 27 October: how to run both suites, the two
  ways of running them that look right and are not, and what state the suite is
  in.

---

## 12. For the viva

`docs/notebook/CodeGuard_AI_Reference_Notebook.docx`, section **§6 Viva Cram
Sheet**, holds 116 question-and-answer pairs covering every defensible decision
in the project. It is the single most useful document to read before being
questioned on this work.

**Where it and this document disagree, it wins.** On 27 October this document was
found to contradict it on two Layer 2 statements, and the notebook was right both
times, with measurements. This file is a summary; the notebook and the code are
sources.
