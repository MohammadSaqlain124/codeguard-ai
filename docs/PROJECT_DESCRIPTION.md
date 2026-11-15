---
title: "CodeGuard AI — Complete Project Description"
subtitle: "What it is, how it works, and who built what"
author: "Mohd Saqlain Hussain · Vanshika Uppal · Shubham Raghav · Trisha Bharadwaj"
date: "15 November 2026 · Dept. of CSE, Invertis University · Guide: Mr. Ashish Sharma"
---

# Part 1 — What this project is

## In one sentence

CodeGuard AI looks at programming assignments students hand in, and tells the
teacher **which ones are worth checking first**.

That is all it does. It never says a student cheated. It puts the submissions
in an order, and shows the teacher why each one is where it is.

## Why that wording matters

We could have built a system that says "this student copied." We decided not
to, on purpose, and the whole project is shaped by that decision.

If the system gives a verdict and it is wrong, an innocent student has been
accused. That is a serious thing to do to someone, and no amount of accuracy
makes it safe, because the system has no way of knowing when it is the one
that is wrong.

If the system gives an **order to look in**, and it is wrong, a teacher wastes
five minutes on a submission that turns out to be fine. Nobody is hurt.

So the output is a number called the **Review Priority Score**. It only sorts
a list. A teacher reads the evidence and decides. We describe it like a metal
detector at an airport: it beeps so a trained person knows where to look. It
does not arrest anyone.

Because of this, three rules run through the whole system:

- **A student never sees a score.** Not hidden in the page — the part of the
  system that answers the student's screen does not send one.
- **Every score shows its working.** Which parts of the code matched, which
  style measurements were unusual, and what the settings were at the time.
- **Every decision is written down.** Who decided, when, and why.

# Part 2 — The problem we are solving

## The old problem, which is already solved

For about thirty years, "plagiarism in code" meant one student copying
another, or copying from the internet. Tools like MOSS and JPlag handle this
well. They work by comparing submissions against each other and against
public code. If two pieces of work are suspiciously similar, they find it.

The important thing about that problem: **there are always two copies**, and
both of them exist somewhere findable.

## The new problem, which is not solved

Since 2023, a student can ask an AI to write the program, or pay a freelancer
to write it. The code that comes back is **original**. It exists nowhere else.
There is no second copy to compare against.

MOSS and JPlag find nothing. Not because they are badly made — because they
are built on an assumption that no longer holds.

This is the gap our project aims at: work where there is only one copy, and
the person who wrote it is not in the class.

# Part 3 — How it works, in simple terms

The system was designed with three detection layers. Each asks a different
question.

## Layer 1 — Structural: "Is this the same shape as someone else's code?"

A program can be written as a **tree**. `if` statements, loops and functions
sit inside one another like branches.

The trick is that we throw away everything a student can easily change —
variable names, spacing, comments — and keep only the shape of the tree. Then
we compare shapes.

This means renaming every variable, reformatting the file, or moving functions
around does not help, because none of those change the shape.

Comparing trees properly is slow, so there is a cheap first step that ranks
candidates by how many kinds of building blocks they share, and only the top
ten get the expensive comparison. That is what makes it usable for a whole
class instead of just a few files.

**Status: built, working, and measured.**

## Layer 2 — Behavioural: "Does this look like how this student normally writes?"

Every programmer has habits. How often they leave blank lines. How long their
lines get. How deeply they nest their code. How much they comment.

Layer 2 builds a picture of each student from their *own past work*, then asks
whether the new submission fits that picture.

The important property: this needs **no second copy**. It is the only one of
the three layers that can notice outsourced work at all, because outsourced
work has no twin to match against.

**Status: built, measured — and the measurement said it does not work for the
case we most wanted.** Part 7 explains this properly. It is the most important
result in the project and we report it rather than hiding it.

## Layer 3 — AI content: "Does this look machine-written?"

Machine-written code has its own habits, the same way people do.

**Status: measured, but not switched on in the running system.** We built the
data and measured how well it can be detected. We did not connect it to the
live system, for reasons in Part 7.

## Putting the layers together

The three scores are combined into the Review Priority Score with a simple
weighted sum — not a trained model. A student appealing a decision has to be
able to follow the arithmetic, and nobody can follow a black box.

Because Layer 3 is not switched on, the weights are rebalanced over the layers
that did run. The settings say 0.4 / 0.3 / 0.3; with the third layer absent
they act as 0.571 / 0.429.

An absent layer contributes **nothing**, not zero. A zero would mean "the layer
looked and found nothing." Absent means it never looked. Those are different
and the system keeps them different.

# Part 4 — What you can actually do with it

**As a student:** sign in, see your courses and assignments, upload your
program, and later see whether it was accepted, whether it was late, how many
attempts you have left, and any decision a teacher recorded about you. You
never see a score.

**As a teacher:** sign in, create courses and assignments, enrol students, see
the review queue in priority order, open any submission's evidence page, and
record a decision with a written reason. You can also mark a piece of work as
a trustworthy example of a student's style, re-run detection, and change the
detection settings for your course.

**As an admin:** everything a teacher can do, plus create and manage accounts
and change roles.

# Part 5 — Everything we used, and why

## Languages

| language | used for | why |
|---|---|---|
| TypeScript | the server and the website | JavaScript with types, so mistakes are caught before running |
| Python | the detection engine and all measurement | the two libraries we need for parsing and tree comparison are Python libraries |
| Kotlin | the Android app | the standard language for Android |

## The website (frontend)

- **React 19** — builds the screens
- **Vite** — runs it while developing and packs it for release
- **React Router** — moves between pages
- **Plain CSS** — one stylesheet, no framework

## The server (backend)

- **Node.js + Express 5** — receives requests and answers them
- **Mongoose** — talks to the database
- **Zod** — checks every incoming request against a declared shape. This is
  also a security boundary: because every value is forced to a declared type,
  injected database operators never reach the database
- **JWT** — sign-in tokens
- **Multer** — file uploads
- **Helmet** — security headers
- **Pino** — logging, with passwords and tokens automatically removed
- **BullMQ on Redis** — the job queue

## The detection engine

- **FastAPI** — serves the three detection endpoints
- **tree-sitter** — turns source code into a tree
- **APTED** — measures how different two trees are
- **scikit-learn, numpy** — the Layer 3 measurements

## Storage

- **MongoDB** — eight collections of records
- **Redis** — the job queue
- **MinIO** — stores the uploaded files themselves

## Tools

- **Docker Compose** — starts the database, queue and file store with one command
- **GitHub Actions** — runs all tests automatically on every push
- **Vitest** — the test runner for the server
- **pytest, ruff** — tests and style checking for Python
- **LaTeX** — the 71-page project report
- **Swagger UI / OpenAPI** — browsable API documentation

## Deliberately not used

Nothing in the running system is a trained machine-learning model. The style
fingerprint is ordinary statistics over a student's own history. That is also
why a student can be told *why* they were flagged — there is an exact
explanation available, not an estimate.

Dropped from the original plan along with the third layer: RoBERTa,
Sentence-BERT, spaCy, Monaco, Tailwind.

# Part 6 — Who built what

## @saqlain — Mohd Saqlain Hussain

**Owns:** the whole platform and the Layer 1 detection engine.

### What he built

The **detection engine** — a Python service that takes source code and answers
how similar two pieces are. It parses the code into a tree, strips out names
and formatting, splits it into functions and classes, runs a cheap first pass
to pick candidates, then does the expensive comparison on the best ten.

The **server** — 32 endpoints covering accounts, courses, assignments,
submissions and results. Role rules, file uploads, the background job queue,
and the worker that runs detection jobs.

The **website** — 10 pages and 5 components, including the evidence page that
a teacher reads before making a decision.

Two things that were not in his original share, which he took on because
without them the output could not be defended: **score composition** (how the
layers combine, and what happens when one is missing) and **baseline
integrity** (five protections that stop a wrong style profile from accusing an
honest student).

### Files — the detection engine (`apps/detector/app/`)

| file | what it does |
|---|---|
| `parsing.py` | turns source text into a tree; returns a tree even when the code is broken |
| `normalise.py` | strips names, values and formatting — this is what defeats renaming |
| `units.py` | splits a file into functions and classes and compares them |
| `similarity.py` | turns a tree distance into a 0–1 similarity score |
| `prefilter.py` | the cheap first pass that picks which 10 candidates get the expensive comparison |
| `features.py` | extracts the ten style numbers Layer 2 uses |
| `main.py` | the three endpoints: health, analyze, features |

### Files — the server (`apps/api/src/`)

| file or folder | what it does |
|---|---|
| `routes/` + `controllers/` | the 32 endpoints |
| `models/` | the 8 database collections, including the audit log |
| `middleware/validate.ts` | checks every request with Zod; also the injection defence |
| `middleware/auth.ts` | who you are and what your role allows |
| `middleware/upload.ts` | file type and size limits |
| `middleware/errorHandler.ts` | one error shape for the whole API |
| `services/detection.ts` | combines the layers into the score and stores the settings used |
| `services/behavioural.ts` | Layer 2's arithmetic |
| `services/anchors.ts` | decides which past work is trustworthy enough to describe a student |
| `services/baseline.ts` | builds the student's style profile from that work |
| `services/access.ts` | who may see which record |
| `services/audit.ts` | writes the history of decisions |
| `services/detectorClient.ts` | talks to the Python engine |
| `queue/detectionQueue.ts` | puts jobs on Redis, with duplicates collapsed |
| `worker.ts` | runs those jobs in the background |
| `app.ts` | wires the server together; also serves the API documentation |

### Files — the website (`apps/web/src/`)

| file | what it does |
|---|---|
| `pages/EvidencePage.tsx` | the most important screen; caveats come before the number |
| `pages/QueuePage.tsx` | the review queue, in priority order |
| `pages/MyResultPage.tsx` | the student's view — status and decision, never a score |
| `pages/SubmitPage.tsx` | upload |
| `pages/FacultyHome.tsx`, `StudentHome.tsx` | the two dashboards |
| `pages/CoursesPage.tsx`, `ManagePage.tsx` | courses, assignments, enrolment, settings |
| `pages/AdminPeople.tsx` | accounts and roles |
| `pages/LoginPage.tsx` | sign-in |
| `components/FingerprintRadar.tsx` | the four-axis style chart |
| `components/PrintHeader.tsx` | makes the evidence page print cleanly for a hearing |
| `components/AppShell.tsx`, `Avatars.tsx`, `SpatialBackground.tsx` | layout and visuals |
| `api/client.ts`, `api/types.ts` | all calls to the server, in one place |
| `auth/AuthProvider.tsx`, `RequireRole.tsx` | sign-in state and role-based access |

### How he checked it works

278 automated tests, all run by the CI gate on every push. Beyond that, he
broke the code on purpose 19 times and checked that a test noticed each time.
Two mutations survived — one reached a path no test covered, one changed an
ordering nothing checked. Both gaps were closed.

The finding is not "19 of 19 caught." It is that a test suite can be green,
large, and blind in one direction, and the only way to know is to attack it.

---

## @vanshika — Vanshika Uppal

**Owns:** the behavioural layer — the style fingerprint — and the study that
tested whether it works.

### What she built

Layer 2 asks whether a submission looks like the student's own usual style.
Four measurements survived testing: blank line ratio, average line length,
maximum nesting depth, and comment density. Ten are extracted; six did not
separate authors well enough to keep.

Each is turned into a score of how far this file sits from the student's own
past work, measured against how much the whole class varies. The four are
combined and capped, so one extreme measurement cannot dominate.

### The study

The real work was **testing whether the idea holds**, not just building it.

She built a corpus of 214 artificially mixed files — real files with part of
another author's code spliced in, at three different amounts. Then she
measured whether Layer 2 notices.

One detail matters: those 214 pairs come from only **94 distinct source
files**, because the same source was reused at three mixing levels. Treating
all 214 as independent would have overstated every result, so every figure is
reported separately by mixing level.

### The result

**It does not work for partial outsourcing**, and the numbers are clear:

| amount mixed in | Layer 2's gap |
|---|---|
| 10% | -0.0124 |
| 25% | -0.0176 |
| 50% | -0.0090 |

Negative means Layer 2 scores the mixed files *lower* than clean ones. Adding
it to Layer 1 made the ranking worse at every level.

### Why — and this is the valuable part

Two structural reasons, both measured rather than guessed:

**The score has no direction.** It measures *how far* a file sits from the
student's usual style, not *which way*. A splice pushes the file about 0.44
standard deviations in whatever direction the other author happens to sit —
which is random. A point already some distance out, pushed randomly, moves
closer about as often as further. She measured this directly: the other author
sat above the student 47.7%, 50.0%, 48.9% and 46.2% of the time across the
four measurements. Four coin flips.

**One measurement cannot be mixed.** Maximum nesting depth does not blend.
Replacing some functions cannot lower a maximum unless the deepest one is
replaced, and another author's function only raises it if theirs is deeper.

Neither is a tuning problem. Both say the same thing: a whole-file distance
cannot detect a partial, directional substitution.

**And she named the fix:** measure per function instead of per file, and
compare against the population with a direction rather than measuring distance
from the student's own average. That is a design change, not a setting change.

### Files (`apps/detector/measurements/`)

| file | what it does |
|---|---|
| `python_authorship.py`, `java_authorship.py` | do the style measurements separate authors at all? |
| `structural_floor.py` | how Layer 1 scores honest work by different people |
| `style_shift.py` | builds the 214-pair mixed corpus |
| `ablation.py` | the main study: does Layer 2 add anything to Layer 1? |
| `layer2_direction.py` | which way the measurements move |
| `suppression.py` | how far there was to move, against how much moved |
| `independence.py` | are the two layers actually independent? |
| `disagreement.py` | how often the layers contradict each other |
| `denominator.py` | checks on the class-spread figure |
| `common.py` | shared machinery for all of the above |
| `README.md` | what every number means and how to reproduce it |

---

## @trisha — Trisha Bharadwaj

**Owns:** Layer 3, the ablation study, and transparent aggregation.

### Layer 3 — building data that did not exist

The original objection to Layer 3 was that it needs examples of real student
code *and* AI-written code, labelled, and nobody had that. We built it.

**The human half:** 96 files from 25 public student project repositories.
Every single file was kept only if **that file's own last change** was before
2023 — repository age is not enough, because an old project can contain a file
edited last year. Dates run from 2017 to November 2022.

**The AI half:** 60 files, generated to match the human files in two ways.
Same mix of tasks. And same writing habits — models put documentation
comments on almost everything while students do so on about one file in nine,
so each file was requested with specific style instructions to match the human
rates. Without that, a classifier separates the two groups by formatting and
learns nothing about who wrote them.

**Three difficulty levels:** raw AI output; AI output with names changed and
comments stripped (what a student covering their tracks would do); and one AI
function inserted into an otherwise human file.

### One trap worth knowing about

If only the AI files get their comments stripped, the classifier wins by
spotting the stripping — not the author. On a deliberately mislabelled test
that produced **100% accuracy that meant nothing at all.**

The fix is to strip comments from some human files too, so the transformation
appears on both sides and cannot be used as a shortcut. With the labels still
deliberately wrong, accuracy then fell to **0%** — the correct answer when
there is nothing to find.

### The result

| what | score |
|---|---|
| overall | 0.952 |
| raw AI code caught | 88% |
| renamed, comments stripped | 80% |
| one function inserted | **37%** |

Honest students were left alone 93% of the time.

**The 37% is the real finding.** Wholesale generation is caught. Partial
insertion is barely better than a coin flip.

And that is the *same boundary Layer 2 hit* — by a completely different
method, on a completely different set of files. Two layers, two methods, one
conclusion: this kind of system catches whole-file substitution and misses
partial substitution. That agreement is worth more than the accuracy number,
because it says something about the problem rather than about our code.

### Two things that could have faked the result, both tested

**Was it just detecting old code vs new code?** The human files are 2017–2022
and the AI files are 2026. Measured: modern Python features appear at 17% vs
25%, type hints 9% vs 12%, others identical. No real gap. Rejected.

**Was it just spotting boilerplate?** The line `if __name__ == "__main__"`
appears in 82% of AI files and 32% of human ones, and on its own scores 0.75.
But removing it entirely changed the result from 0.952 to 0.962 — no
difference. The result does not rest on it. Rejected.

### Transparent aggregation

She also owns how the layers combine into one score, and why there is no SHAP
plot in the report.

SHAP is a technique for estimating which inputs drove a trained model's
output. Nothing in our running system is trained — so instead of estimating,
Layer 2's score is broken down **exactly**: each measurement's share is its
squared value divided by the total of the squares. It adds to 100% and is not
an approximation. An exact answer beats an estimate of the same thing.

### Files

| file | what it does |
|---|---|
| `collect_human.py` | gathers student code, filtered by each file's own commit date |
| `ai_corpus.py` | builds the labelled set at three difficulty levels |
| `check_ai_corpus.py` | checks each generated file matches the style it was asked for |
| `baseline_classifier.py` | the classifier, the controls, and the boilerplate test |
| `shape_check.py` | proves renaming changes only names, not program structure |
| `train_codebert.py` | the CodeBERT training script — written, never run |
| `test_train_codebert.py` | 25 tests for the parts that can be tested without a GPU |
| `interpretability.py` | ROC and PR curves, and the exact score breakdown |
| `base_rate.py` | why even an accurate detector mostly raises false alarms when cheating is rare |
| `AI_CORPUS_PROMPTS.md` | the 60 prompts, with their style instructions |

---

## @shubham — Shubham Raghav

**Owns:** the Android app.

### Status: not started. Scope and contract now fixed.

This was planned from the beginning as the piece to drop if time ran short —
the project proposal's risk section named it. Time ran short, and it was
dropped. It is now ready to begin.

### What the app is for

**For teachers:** the review queue on a phone. Open a case between classes,
read its evidence, record a decision.

**For students:** submission status, deadline, attempts left, and any decision
recorded about them. No score — not hidden by the app; the server does not
send one.

The app adds no detection logic and stores nothing of its own. It is a second
window onto a server that already exists.

### What it talks to

Six of the server's 32 endpoints cover the whole app:

| endpoint | purpose |
|---|---|
| `POST /api/auth/login` | sign in, get a token and role |
| `GET /api/assignments/{id}/results` | the ranked review queue |
| `GET /api/submissions/{id}/result` | the evidence behind one score |
| `PATCH /api/submissions/{id}/review` | record a decision |
| `GET /api/submissions/{id}/student-view` | the student's view |
| `POST /api/assignments/{id}/submissions` | upload |

All six already exist and are already tested, so the contract will not move
under the Android work. The full specification is in `docs/openapi.yaml` and
can be browsed at `/api/docs` when the server is running.

### Two rules the app must respect

1. Several teacher-only endpoints answer **404 instead of 403** to a student —
   on purpose, because a 403 would confirm the record exists. Do not treat 404
   as "deleted."
2. The student view has **no score field at all**.

### Planned order of work

1. Sign-in against the real server, token stored, role read
2. The ranked queue, with pull-to-refresh
3. The evidence screen, with the caveats shown before the number
4. Recording decisions
5. The student view

Steps 1 and 2 alone are a working demonstration.

**Tools:** Kotlin, Jetpack Compose, and an HTTP client. Nothing else is needed.

# Part 7 — What is finished and what is not

## Finished

- Layer 1, structural detection — built, and verified with a control test that passes
- Layer 2, the style fingerprint — built, and measured
- The full study that tested our research claim, with its control
- The score composition, including what happens when a layer is missing
- Five protections against a wrong style profile accusing an honest student
- The complete platform: server, website, queue, worker, storage
- 278 automated tests plus mutation testing, all in an automatic gate
- Layer 3's data and measurements
- ROC and PR curves, and the base-rate analysis
- A 71-page report and browsable API documentation

## Not finished

**Layer 3 is measured but not switched on.** Three things stand in the way,
and none is small: nothing is served as a running model, nothing is calibrated
for showing to a person, and the evidence page would have nothing to point at.
Layers 1 and 2 can both show *what* caused a score — a matching section of
code, a measurement away from normal. A text-pattern probability points at
nothing, and we measured that it is wrong on partial insertion more often than
right. Showing it to a teacher without an explanation would break the rule the
whole system is built on.

**CodeBERT itself has never been trained.** The script exists and its testable
parts are tested. No CodeBERT accuracy figure appears anywhere in this project
and none should be quoted.

**The Android app has not been started.**

**There is no way for a user to change their own password.** This was a
deliberate decision — an administrator must never set someone else's password
— but the self-service version was never built.

**No bulk import of an official student list.** Accounts are created one at a
time or by the seeding script.

**Only Python and Java.** The study ran on Python only.

**No real plagiarism data.** Every figure describes either honest work by
different authors, or artificially mixed files we built ourselves. A labelled
set of genuine student plagiarism does not exist, and manufacturing one would
be worse than admitting its absence.

## Honest limitations worth stating out loud

- The Layer 3 data is small — 351 items — so every figure has wide error bars
- Two thirds of the AI files came from one model, so other models are untested
- Only 21 of 96 human files had enough functions to host an inserted one
- The 214-pair corpus rests on 94 independent sources, and is reported that way

# Part 8 — Future goals

**Near term**

- Rebuild Layer 2 per function with a directional comparison — the fix is already named
- Train CodeBERT and compare it against the simple classifier, with one specific question: does it do better on partial insertion, where the simple one fails?
- Build the Android app
- Self-service password change
- Bulk import of an official student list

**Longer term**

- Deploy it so teachers can use it without a laptop setup
- Support C++ as a third language
- Institution-wide trends over time
- Connect to an existing LMS so students submit where they already work

# Part 9 — The one thing to remember

We set out to prove that a per-student style baseline could detect outsourced
work. We built it, we tested it properly with a control, and **the test said
no.**

We reported that. We can explain exactly why it failed, in two specific
structural reasons that we measured. We named the fix. And then a completely
different method, on completely different data, found the same boundary.

A project that quietly drops a claim when it fails has learned nothing. A
project that measures it, reports the answer, explains the mechanism and names
the fix has done the actual work.
