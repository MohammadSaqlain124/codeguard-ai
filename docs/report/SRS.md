# Software Requirements Specification — CodeGuard AI

**Project:** Code Plagiarism Detector Using AST and Behavioural Fingerprinting
**Institution:** Invertis University, Bareilly · AY 2026–2027
**Document version:** 1.0, 03 November 2026
**Intended placement:** Report Appendix A, summarised in Chapter 3

> **Nature of this document.** This is an **as-built specification**: it was
> reconstructed from the implemented system, its tests and its configuration,
> rather than written in advance of construction. It is presented as such
> deliberately. Every requirement below is traceable to code that exists, and
> no requirement describes behaviour that has not been built. Where the
> implementation falls short of what a requirement would ideally state, the
> shortfall is recorded in the requirement itself rather than omitted.
>
> Requirements are identified as FR-n (functional), NFR-n (non-functional) and
> DR-n (data). Identifiers are stable; do not renumber them, because Chapter 6's
> test table refers to them.

---

## 1. Introduction

### 1.1 Purpose

CodeGuard AI ranks programming assignment submissions by the likelihood that
they warrant human review for academic misconduct, and attaches to each ranking
the evidence that produced it. It is an evidence system and not a verdict
machine: it produces an ordering and a justification, and a member of faculty
makes the decision.

This document specifies what the system does, for whom, under what constraints,
and with what limits.

### 1.2 Scope

The system addresses three forms of misconduct in submitted source code:

1. **Collusion** — two or more students submitting structurally equivalent
   work. Addressed by Layer 1, structural AST similarity.
2. **Outsourcing** — a student submitting work written by a third party, with
   no second copy in the cohort. Addressed in design by Layer 2, behavioural
   fingerprinting. **See NFR-9 for the measured limitation on this claim.**
3. **Machine-generated submission** — work produced by a language model.
   **Out of scope in this version**; see §2.6.

Supported languages are Python and Java. The system handles single-file
submissions.

### 1.3 Definitions

| term | meaning |
|---|---|
| **RPS** | Review Priority Score. The composed, renormalised score a submission is ranked by. |
| **Layer 1** | Structural detection: AST comparison between a submission and cohort candidates. |
| **Layer 2** | Behavioural detection: comparison of a submission's style against its own author's baseline. |
| **Layer 3** | Detection of machine-generated code. Not implemented; see §2.6. |
| **Anchor** | A past submission trustworthy enough to describe a student's style. |
| **Baseline** | A per-student, per-language style profile built from anchors. |
| **Cohort** | The other students whose work provides comparison candidates and distributional statistics. |
| **Provenance** | Whether an assignment was invigilated or taken home, which determines anchor trust. |

### 1.4 References

- `docs/PROJECT_STATUS.md` — the as-built inventory this document derives from
- `docs/PROJECT_NOTES.md` — the decision record, including retractions
- `docs/TESTING.md` — the suite contract
- `apps/detector/measurements/README.md` — the measurement record and its limits
- `docs/report/references.bib` — academic citations

---

## 2. Overall description

### 2.1 Product perspective

Three tiers and one detection service:

- **Web client** (`apps/web`) — React and Vite. Holds no credentials and talks
  only to the API.
- **API** (`apps/api`) — Node, Express, TypeScript, Mongoose. Holds all
  credentials and is the only component that reaches a data store.
- **Detector** (`apps/detector`) — Python, FastAPI, tree-sitter, APTED.
  Stateless; parses and compares source, and extracts style features.
- **Infrastructure** — MongoDB (documents), Redis (job queue), MinIO-compatible
  object store (submitted files).
- **Worker** — the same codebase as the API started on a different entry point,
  so a queued job and a request share one set of services rather than two
  implementations that can diverge.

### 2.2 User classes

| class | may |
|---|---|
| **Student** | submit work, view their own submission status and any recorded decision, answer a flag, nominate past work as an anchor |
| **Faculty** | create courses and assignments, enrol students, view the ranked review queue and full evidence, record decisions, accept nominations, re-run detection |
| **Admin** | all of the above, plus create accounts with roles and edit detection configuration |

A student never sees a score. This is a design decision and not an oversight:
a ranking a student can read is a ranking a student can tune against.

### 2.3 Operating environment

Developed and run on Windows with Docker Desktop providing MongoDB, Redis and
the object store via `infra/docker-compose.yml`. CI runs on Ubuntu with the
same services. The detector targets Python 3.11.

### 2.4 Design and implementation constraints

- Single-file submissions only; no archive or multi-file project support.
- Two languages only, enforced by extension allow-list.
- The detector accepts at most 50 comparison candidates per request, and
  compares at most 10 of them in full (§3.3, NFR-3).
- The API is the only holder of credentials; no credential appears in the web
  client or the detector.

### 2.5 Assumptions and dependencies

- A student's past work is available and attributable to them, which is what
  makes a baseline possible. Where it is not, Layer 2 declines to score.
- Invigilated work is genuinely the student's own. The anchor provenance model
  rests on this and cannot verify it.
- Cohort members are solving comparable problems, so that distributional
  statistics are meaningful.

### 2.6 Explicitly excluded from this version

**Layer 3, detection of machine-generated code, is not implemented.** The
decision was taken on 06 October 2026 and is recorded rather than hidden: every
detection result stores
`aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" }`.

The reason is a requirements problem and not a scheduling one. The published
approach this layer would have followed reports that classifier accuracy
depends on training data resembling the target code, which requires a labelled
corpus of student work from the course being policed. No such corpus exists,
and manufacturing one would mean treating synthetic submissions as ground
truth. A layer whose output cannot be characterised is worse than an absent
layer in a system whose premise is auditable evidence, because a reviewer would
have no basis on which to weigh it.

Also excluded: real-time push notification of queue changes (the queue is
polled), and side-by-side AST diff rendering of two sources.

---

## 3. Specific requirements

### 3.1 Functional requirements

#### Authentication and accounts

- **FR-1** The system shall allow public self-registration, which shall create
  an account with the student role and no other.
- **FR-2** The system shall authenticate by email and password and issue a
  short-lived access token and a longer-lived refresh token.
- **FR-3** The system shall allow a held refresh token to be exchanged for a
  new access token, and shall allow logout to invalidate it.
- **FR-4** The system shall allow an authenticated user to retrieve their own
  account.
- **FR-5** The system shall allow an admin, and only an admin, to create an
  account with a chosen role, and to amend an existing account.
- **FR-6** The system shall allow an admin to list accounts, paged, filtered by
  role and active state, and searchable by term.

#### Courses, enrolment and configuration

- **FR-7** The system shall allow faculty to create a course and to amend it.
- **FR-8** The system shall allow faculty to enrol a student on a course and to
  remove one.
- **FR-9** The system shall expose, per course, the detection configuration in
  force, and shall allow an authorised user to amend it.
- **FR-10** Detection configuration shall support per-language overrides, so
  that one course may weight Python and Java differently.

#### Assignments

- **FR-11** The system shall allow faculty to create an assignment carrying its
  language and its provenance (invigilated or take-home), and to amend it.
- **FR-12** The system shall expose, per assignment, the review queue ordered by
  RPS descending.

#### Submission

- **FR-13** The system shall accept a single source file per submission,
  rejecting any file whose extension is outside the configured allow-list or
  whose size exceeds the configured maximum.
- **FR-14** The system shall store the submitted file in the object store and
  retain a content hash of it.
- **FR-15** The system shall enqueue detection on upload, debounced by job
  identity, so that many uploads arriving at a deadline collapse into a
  bounded number of detection runs rather than one run per upload.
- **FR-16** The system shall allow a student to retrieve their own submission
  and its file, and faculty to retrieve any submission within their courses.

#### Detection

- **FR-17** The system shall compute a structural similarity score for a
  submission against candidates drawn from the cohort.
- **FR-18** The system shall compute a behavioural score for a submission
  against that student's own baseline for the submission's language, where a
  baseline of sufficient quality exists.
- **FR-19** The system shall compose the available layer scores into one RPS,
  **renormalised over the layers that actually ran**. An absent layer shall
  contribute nothing, rather than contributing a zero, because a zero is a
  finding and an absent layer has made no finding.
- **FR-20** The system shall store, on every result, the weights and review
  threshold that produced it, so that the result remains interpretable after
  the configuration changes.
- **FR-21** The system shall store both layers' evidence on the result, not
  merely their scores, so that the evidence view is reproducible from stored
  data rather than recomputed on demand.
- **FR-22** The system shall allow faculty to re-run detection on a submission;
  a re-run shall supersede the previous result by revision without destroying
  it, because a decision may already have been recorded against the old one.

#### Baseline integrity

- **FR-23** Only invigilated work, or work a student nominates and faculty
  accept, shall be eligible to describe that student's style.
- **FR-24** The system shall allow a student to nominate a past submission as
  an anchor and to withdraw that nomination, and faculty to accept it.
- **FR-25** Where fewer than `minAnchorsForBaseline` (3) anchors exist, Layer 2
  shall decline to score rather than scoring on a guess.
- **FR-26** A thin or inconsistent baseline shall attenuate Layer 2's effective
  weight rather than being trusted at full strength.
- **FR-27** Where a student's own work varies less than the cohort's, the result
  shall carry a low-variance flag, because z-scoring penalises such a student.
- **FR-28** Where the pooled cohort spread has collapsed, the result shall carry
  a cohort-saturation flag, because every z-score is then a real difference
  divided by an invented floor and the layer has stopped discriminating.

#### Review and the student's view

- **FR-29** The system shall allow faculty to record a decision against a
  submission.
- **FR-30** The system shall expose to a student a view of their own submission
  carrying its status and any recorded decision, **and no score**.
- **FR-31** The system shall allow a student to submit a written explanation
  against a recorded decision.

#### Audit

- **FR-32** The system shall record every state change affecting a student's
  record in an audit log held separately from the documents it describes, so
  that the record of who changed what cannot be amended by the same operation
  that changes the thing.

### 3.2 External interfaces

35 HTTP endpoints. The API surface is 32 routes across four routers; the
detector exposes 3.

| router | count | endpoints |
|---|---|---|
| `authRoutes.ts` | 8 | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `GET /users`, `POST /users`, `PATCH /users/:userId` |
| `courseRoutes.ts` | 8 | `GET /`, `GET /:courseId`, `POST /`, `PATCH /:courseId`, `POST /:courseId/students`, `POST /:courseId/students/remove`, `GET /:courseId/config`, `PATCH /:courseId/config` |
| `assignmentRoutes.ts` | 5 | `GET /`, `POST /`, `GET /:assignmentId`, `PATCH /:assignmentId`, `GET /:assignmentId/results` |
| `submissionRoutes.ts` | 11 | `POST /`, `GET /`, `GET /:submissionId`, `GET /:submissionId/file`, `GET /:submissionId/result`, `GET /:submissionId/student-view`, `PATCH /:submissionId/explanation`, `PATCH /:submissionId/review`, `POST /:submissionId/nominate`, `DELETE /:submissionId/nominate`, `POST /:submissionId/rerun` |
| detector `main.py` | 3 | `GET /health`, `POST /analyze`, `POST /features` |

The web client presents 10 pages and 5 shared components. The detector is
reachable only from the API and only with a bearer token.

### 3.3 Non-functional requirements

- **NFR-1 (security — credential isolation)** No credential shall appear
  outside the API. The web client and the detector shall hold none.
- **NFR-2 (security — authorisation)** Every route shall enforce role and
  course-scope authorisation; a faculty member shall not read a submission
  outside their own courses.
- **NFR-3 (performance — bounded comparison)** The detector shall accept at
  most 50 candidates per request and shall run full tree comparison on at most
  10 of them, selected by a cheap label-bag prefilter. This bounds the cost of
  one analysis irrespective of cohort size, and it is the behaviour any
  measurement of Layer 1 must reproduce to be faithful.
- **NFR-4 (performance — upload bound)** Submitted files shall be limited to
  the configured maximum (262,144 bytes as configured) and the detector request
  body to 16 MB.
- **NFR-5 (reliability — queue)** Detection shall be queued rather than
  synchronous, and debounced by job identity.
- **NFR-6 (auditability)** A result shall be interpretable from stored data
  alone, without re-running detection and without reference to the current
  configuration.
- **NFR-7 (evidence quality)** A reported match shall meet a minimum span size
  (10 nodes) before being shown to a reviewer, because two one-line functions
  resemble each other by virtue of being one line long.
- **NFR-8 (explainability)** Every feature contributing to a behavioural score
  shall be explainable to a student contesting a flag. This constrains the
  feature set to a size a person can be walked through, and is the reason four
  features are scored rather than the ten extracted.
- **NFR-9 (stated limitation — Layer 2 efficacy)** Layer 2's ability to detect
  **partial** outsourcing is **not established**. On the 214-pair style-shift
  corpus (94 distinct source files) the layer did not separate spliced files
  from clean ones at any splice fraction, and combining it with Layer 1
  degraded ranking precision. The cause is understood and structural: the four
  scored features are whole-file aggregates, and the score is a magnitude of
  deviation, so a partial substitution displaces a file in a direction that is
  as likely to move it toward its baseline as away. Any requirement asserting
  that Layer 2 detects outsourcing must be read against this. The design
  direction for addressing it — per-unit rather than whole-file features, and a
  signed rather than magnitude comparison — is future work and is not built.
- **NFR-10 (stated limitation — Layer 1 efficacy)** No precision or recall
  figure exists for structural similarity on *known-copied* pairs, because no
  labelled corpus of genuine student plagiarism exists. The measured
  distribution is over honest work by different authors, which is a different
  claim.

### 3.4 Data requirements

Eight document collections.

| id | collection | holds |
|---|---|---|
| **DR-1** | `User` | accounts and roles: admin, faculty, student |
| **DR-2** | `Course` | a course and its enrolment |
| **DR-3** | `Assignment` | an assignment, its language, its provenance |
| **DR-4** | `Submission` | an uploaded file reference, its hash, its status |
| **DR-5** | `DetectionResult` | the score, both layers' evidence, the applied weights and threshold, the recorded review |
| **DR-6** | `DetectionConfig` | per-course weights and thresholds, with per-language overrides |
| **DR-7** | `BaselineProfile` | a student's style baseline, per language |
| **DR-8** | `AuditLog` | every state change affecting a student's record |

- **DR-9** `DetectionResult` shall carry `isCurrent` and `revision`, so that a
  re-run supersedes without destroying.
- **DR-10** `AuditLog` shall be independent of the documents it describes
  (see FR-32).

---

## 4. Verification

Requirements are verified by the automated suite described in `docs/TESTING.md`:
155 API tests and 123 detector tests. The suite is run in CI on every push,
including the API integration tests, which were added to the gate on
01 November 2026.

Chapter 6 of the report carries the test-case table mapping requirement
identifiers to tests, together with the mutation-testing results: 19 deliberate
mutations across the detector suite, of which two were not caught on the first
attempt and exposed a dead code path and a missing sort assertion.

**Requirements NFR-9 and NFR-10 are verified as limitations rather than as
capabilities**, by the measurement scripts in `apps/detector/measurements/`,
each of which is committed and re-runnable.
