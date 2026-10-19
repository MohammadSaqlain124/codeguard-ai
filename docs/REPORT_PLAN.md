# Report plan

Written 07 October 2026, Day 23, with 88 files committed and no report started.
Revised 19 October 2026, Day 32, at 103 files. This is a working document: edit
it rather than treating it as fixed.

It is deliberately format-independent. Nothing here depends on whether the
report is written in Word or LaTeX, so the writing can be planned before that
is settled.

---

## Status, 19 October 2026

What this plan asked to be decided has been decided, and in two places the
answer was overtaken by work that happened afterwards. The original reasoning
is left below unedited, because it is the reasoning that produced the choices.

| question | answer | where |
|---|---|---|
| Word or LaTeX | LaTeX | File 092 |
| chapter list | the nine below; Invertis prescribes none | File 092 |
| demo: A, B or C | B was chosen and built, then A was built anyway | Files 095, 102, 103 |

**The demo answer is the one worth reading twice.** Option B shipped as
`apps/api/src/scripts/demo.ts` on 08 October. The web interface this plan said
did not exist was then built regardless, between 14 and 18 October: login,
courses, review queue and evidence page, in `apps/web`. So the viva has both a
terminal walkthrough and a normal demo, and this plan's central worry — that a
UI would eat the report's time — has partly come true in that the report is
still the least advanced part of the project.

**What changed in the chapters:** Chapter 7's "missing measurement" is no longer
missing (File 097 measured Layer 1 across 15 Python repositories), and Chapter 6's
test counts have moved. Both are corrected in place below. Chapter 2 remains
untouched and is still the largest gap in the report.

**What the evidence page added to Chapters 5 and 7.** Rendering real data
through a screen found nine defects that the test suite had not, four on Day 30
and five on Day 31, and three of the first four pre-dated the page. That is a
testing-methodology finding rather than a frontend anecdote, and it belongs in
Chapter 6 beside the mutation testing.

---

## The thing to decide first, before any chapter is written

> **RESOLVED 08 October, and partly overtaken.** Option B was chosen and built;
> a web interface was then built as well. The section is kept for the reasoning.

**There is no user interface.** `apps/` contains `api` and `detector` and
nothing else. Every capability the system has is reachable only over HTTP.

That matters for two different reasons, and they pull in opposite directions:

- **A viva is usually a demonstration.** An examiner asked to look at a
  plagiarism detector generally expects to see a submission uploaded and a
  result appear. Postman or curl can show the same thing, but it reads as an
  unfinished project to anyone who is not reading the code.
- **The backend is the part with real evidence behind it**, and a thin UI
  added late adds no evidence at all. 184 tests, two reproducible measurements
  and a documented RPS do not become more credible because a web page sits on
  top of them.

Three honest options, with what each costs:

| option | cost | what the viva looks like |
|---|---|---|
| **A. Minimal web UI** — login, upload, results list, one result detail page | 3 to 5 days | a normal demo |
| **B. Scripted demo** — seeded data, a shell or Python script that uploads and prints the RPS with its evidence, plus a Postman collection | half a day | a terminal walkthrough, honest but plainer |
| **C. No demo** — report and code only | none | weakest; relies entirely on the examiner reading the report |

**My recommendation is B now and A only if the report finishes early.** The
report is mandatory and always takes longer than expected; a demo script is
cheap insurance that guarantees something to show. Option A is the better
outcome but it is the thing most likely to eat the time the report needs. This
is your call, and it changes the Chapter 7 plan below.

---

## Chapter plan, with the evidence that already exists

File numbers refer to `docs/PROJECT_NOTES.md`. "Have" means it is committed and
could be written up today. "Need" is real remaining work.

### 1. Introduction

**Claims:** academic plagiarism in programming assignments; why text-similarity
tools fail on code; why a single similarity percentage is the wrong output; the
system as an **evidence system, not a verdict machine**.

- **Have:** the framing is stated throughout the notes and is the project's
  strongest idea. Objectives and scope are derivable from Files 001 to 005.
- **Need:** written from scratch, about 4 to 6 pages. Must state plainly that
  Layer 3 was dropped, and why, rather than leaving it as an unexplained
  absence in the architecture.

### 2. Literature survey

**Claims:** where the three layers come from and what is already known.

- **Have: nothing. This is the largest genuine gap in the whole report.**
- **Need:** 15 to 25 references, read and summarised, covering at least
  token-based detection (MOSS, JPlag, Sherlock), AST and tree-edit-distance
  approaches (which is what APTED gives Layer 1), source-code authorship
  attribution and stylometry (Layer 2's basis), and AI-generated-code detection
  (to justify dropping Layer 3 from evidence rather than from laziness).
- **Estimate: 3 to 4 days.** It cannot be compressed much and nothing in the
  repository substitutes for it. Starting it before the writing chapters is
  probably correct, because Chapters 1 and 3 both cite it.

### 3. System analysis and requirements

**Claims:** functional and non-functional requirements, feasibility, the
existing-versus-proposed comparison.

- **Have:** the data model is fully specified across Files 020 to 027 (User,
  Course, Assignment, Submission, DetectionConfig, DetectionResult, AuditLog).
  Access control is File 046. Rate limiting is File 053. Authentication is
  Files 033 to 039.
- **Need:** no SRS document exists. The requirements have to be written out
  properly, not inferred by the reader from the schema.

### 4. System design

**Claims:** architecture, data flow, the detection pipeline, the database
design.

- **Have:** the architecture in prose (API, detector, Mongo, Redis, object
  store, worker), the queue design (Files 056, 057), the detector pipeline
  (Files 060 to 065), RPS composition (File 076), baseline design (Files 071 to
  074, 077).
- **Need: every diagram.** Nothing in the repository is a diagram. At minimum:
  a deployment or component diagram, an ER diagram for the six models, a
  sequence diagram for submission through to RPS, and a DFD. These are also
  the figures the viva will be conducted from, so they are worth real effort.
- **Estimate: 1 to 2 days.** Drawing them will expose design inconsistencies;
  budget time to fix what they reveal rather than drawing around it.

### 5. Implementation

**Claims:** the stack, the modules, the parts worth showing code for.

- **Have:** almost everything. The strongest candidates to show and explain
  are `prefilter.py` (Files 064 and its two revisions, including the starvation
  fix and the separation of matching from scoring), `similarity.py` (File 062),
  `behavioural.ts` (File 075), `detection.ts` (File 076), and the baseline
  integrity work with its five mitigations (Files 071 to 074, 077, 079).
- **Need:** selection and prose only. Resist pasting whole files; two or three
  listings per layer with explanation beats forty pages of appendix-grade code.

### 6. Testing

**Claims:** the system is verified, and how.

- **Have:** 155 API tests as of 18 October, up from 63 when this was written.
  The detector figure of 121 dates from File 083 and has not been re-counted;
  confirm it before it goes in the report rather than quoting this line. The CI
  gate (typecheck, ruff, pytest, `audit:prod`). **The mutation testing is the
  standout item**: 19
  deliberate mutations across the detector suite, all caught, and two that were
  *not* caught first time, which found a dead code path and a missing sort
  test. Very few undergraduate reports contain anything like it.
- **Need:** a test-case table, and the mutation-testing section written up
  properly, because it is the part an examiner is most likely to ask about.

### 7. Results and discussion

**Claims:** does Layer 2 actually work, and how well.

- **Have: the strongest chapter in the report, and it is already reproducible.**
  `apps/detector/measurements/` holds both measurements as committed scripts
  sharing one module. Java: 123 files, 15 authors, 11 repositories. Python: 204
  files, 27 authors, 15 repositories. Zero parse failures in 327 files.
  Everything is reported with a sampling range across 25 draws rather than as a
  point estimate.
- The findings that belong here, all from Files 086 to 088: the two languages
  are equivalent at matched author counts; the repository confound accounts for
  much of any cross-project figure; within one project the features reach about
  1.4x to 2.5x where they work at all and fail to beat chance in more than half
  the projects tested; size banding does not help in either language; and
  `blank_line_ratio`, one of the four features actually scored, carries almost
  no author signal in Python.
- **Need:** charts rather than pasted terminal output, and a decision on how
  much of the retraction history to include (see the next section).
- **Layer 1, measured since this was written (File 097).** 15 Python
  repositories, 1,989 candidate files, 466 single-author, 204 selected across 8
  repositories and 27 authors, 100 pairs per category at seed 0 under production
  comparison settings. Note that only 8 of the 15 repositories produced any
  qualifying author, which is a sampling fact the chapter should state.
- **Still missing, and still a limitation.** There is no precision or recall
  figure for AST similarity on *known-copied* pairs, because no labelled corpus
  exists. File 097 measured the distribution on honest work by different
  authors, which is not the same claim. **State this as a limitation**;
  manufacturing a labelled corpus now would be worse than admitting it.
- **A retraction belongs here.** File 096 claimed Layer 1 similarity has a floor
  near 0.5; File 097 retracted it. The argument assumed two trees of the same
  shape differing only in labels, and real unrelated code differs in shape too.

### 8. Conclusion and future work

- **Have:** the carry-over list in `PROJECT_NOTES.md` is an unusually honest
  future-work section already. Layer 3, the `behavioural.ts` scoring decision,
  Layer 1 measurement, and the remaining small items all belong here.

### 9. References, and appendices

- **Need:** follows from Chapter 2. Appendices should hold the SRS, the test
  case tables and selected code, not bulk listings.

---

## The methodology question, and it is worth getting right

Three days of this project were spent finding errors in its own measurements:
a platform-dependent sort, a single arbitrary sample quoted to three
significant figures, an alias merge applied after the ownership share instead
of before, and a lift metric that was never comparable across runs with
different author counts. Three published claims were retracted in the process.

There are two ways to write that up.

**Hide it.** Report only the final numbers. Shorter, and conventional.

**Report it.** A methodology section on how the measurements were validated,
what was found wrong, and what changed. This is riskier to write and much
stronger if written well, because it demonstrates something most
undergraduate projects cannot: that the numbers were tested rather than
produced. It also pre-empts the single most dangerous viva question — *"how do
you know that figure is reliable?"* — by answering it before it is asked.

**My recommendation is to report it**, in a short methodology subsection of
Chapter 7 rather than as a confessional. Frame it as validation practice: the
draws mechanism exists *because* a single sample proved unreliable, and the
fixed-author-count table exists *because* lift proved not to be comparable.
Both are now permanent features of a committed script.

---

## Suggested order of work

1. ~~**Decide the demo question**~~ — done, 08 October. B built, then A built.
2. **Literature survey** (Chapter 2). Longest lead time, and Chapters 1 and 3
   cite it.
3. **Diagrams** (Chapter 4). They will surface design questions worth fixing
   while there is still time.
4. **Chapters 5, 6, 7.** Mostly assembly; the material exists.
5. **Chapters 1, 3, 8.** Easier once the middle is written and the framing has
   settled.
6. **References and appendices.**

Both answers this plan was waiting on arrived on 08 October: the report is
written in LaTeX, and Invertis prescribes no chapter list, so the nine above
stand.

**What actually blocks the report now, in order:** Chapter 2 is unwritten and
nothing in the repository substitutes for it; no diagram of any kind exists; and
4 of 13 references are verified. Items 2 and 3 of the order above have not
started, while items 4 and 5 have been accumulating material daily. Files 096 to
103 of `PROJECT_NOTES.md` are already most of Chapters 4 and 5 in draft form and
need selecting and rewriting rather than researching.
