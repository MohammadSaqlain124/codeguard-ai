# Chapter 5 — Implementation: how the system works

> **Draft status, 03 November 2026.** Written from the implemented code and
> from `docs/PROJECT_STATUS.md`. Every constant quoted below is named in the
> source; **check each against the file cited beside it before submission**,
> because a constant quoted wrongly in a report is the easiest thing for an
> examiner to catch and the hardest to recover from. Figures 1 to 5 referred to
> here are the committed diagrams in `docs/diagrams/`.

---

## 5.1 The stack, and why each part is where it is

| tier | technology | reason |
|---|---|---|
| Web client | React 19, Vite | the examiner-facing demonstration; holds no credentials |
| API | Node, Express 5, TypeScript, Mongoose | the only tier that holds credentials or reaches a store |
| Detector | Python, FastAPI, tree-sitter, APTED | the parsing and tree libraries that exist are Python ones |
| Documents | MongoDB | the detection result is a nested document, not a set of rows |
| Queue | Redis | detection is slow and must not block an upload |
| Files | MinIO-compatible object store | submitted source is a blob, not a column |

The split between API and detector is the one design decision worth defending
in a viva, because it looks like unnecessary complexity for a student project.
It is not. The parsing ecosystem this project needs — tree-sitter grammars and
an APTED implementation — is Python. The web application and its data model are
far more naturally expressed in TypeScript against Mongoose. Rather than
compromise one to accommodate the other, the system makes the detector a
stateless HTTP service that parses and compares, and keeps every piece of state,
every credential and every authorisation decision in the API.

The worker is deliberately *not* a separate codebase. It is the API started on
a different entry point, so a queued detection job and a synchronous request
share one set of services. Two implementations of the same scoring logic would
drift, and the drift would appear as a result that cannot be reproduced.

## 5.2 Layer 1 — structural similarity, in working order

Layer 1 answers *does this submission resemble another submission?* Its chain
runs through four stages, and the stages matter because two of them operate on
different representations of the same file.

### 5.2.1 Parsing

`app/parsing.py` exposes `parse_source(language, source)`, returning a
`ParseResult` carrying `ok`, `node_count`, `error` and `root`. One detail is
load-bearing and caused a real defect during the measurement work: **the root
is returned even when the parse fails.** tree-sitter is an error-recovering
parser, so a syntactically broken file still yields a tree. Any caller that
tests `root is None` rather than `ok` will therefore proceed on a tree built
from broken source. Callers test `ok`.

### 5.2.2 Normalisation

`app/normalise.py` turns the raw tree-sitter tree into a `TNode` tree via
`normalise(node)`. Normalisation is where the resistance to obfuscation comes
from: identifier names, literal values and formatting are discarded, and each
node carries a `label` describing its syntactic kind rather than its text. This
is what makes renaming a variable invisible to Layer 1.

**The two representations are not interchangeable, and the report should say
so plainly**, because it is the clearest illustration of what each layer is
looking at:

- Layer 1 consumes the **normalised** tree, because structure is what survives
  obfuscation.
- Layer 2 consumes the **raw** tree, because style lives precisely in the
  things normalisation throws away — blank lines, comments, line lengths.

The same source file is therefore read twice, in two different ways, for two
different questions. `extract_units` and `size` take the normalised tree;
`extract_features` takes the raw root and the source bytes.

### 5.2.3 Unit extraction

`app/units.py` provides `extract_units(tree, language)`, which splits a
normalised tree into comparable top-level units — functions, methods, classes —
rather than treating the file as one monolithic tree. Comparing whole files
would make a long honest file resemble another long honest file simply by
virtue of both being long. Comparing unit against unit allows the system to
report *which* parts matched, which is what a reviewer needs.

### 5.2.4 Prefilter: the step that makes it affordable

`app/prefilter.py` exists because tree edit distance is expensive. It builds a
`Counter` of node labels per tree — `label_counts` — and scores candidate pairs
by bag overlap with `quick_similarity`, which is cheap and approximate and
never final. `rank` then nominates the most promising candidates.

Two constants from `app/main.py` govern the cost:

- `MAX_CANDIDATES = 50` — the most candidates the endpoint will accept at all.
- `MAX_DEEP_CANDIDATES = 10` — of those, how many earn the expensive treatment.

So a submission is compared in full against at most ten candidates however
large the cohort is. This bounds one analysis irrespective of class size, and it
is also a **fidelity requirement on any measurement of Layer 1**: a study that
compares exhaustively is measuring a system that was never deployed, and will
credit the layer with matches the API cannot find. That error was made and
corrected during this project's own ablation work, and Chapter 7 records it.

`shortlist_pairs` nominates pairs from *both* directions. Shortlisting in one
direction starves units nobody happens to pick: if every unit of A nominates
the same five units of B, the remainder of B is never offered to anyone and
their partners in A go unmatched.

### 5.2.5 Comparison and scoring

`compare_unit_sets(units_a, units_b, size_a, size_b)` returns a `FileComparison`
carrying the similarity, the matched unit pairs, coverage on each side, and
counts of pairs compared, pruned and skipped. The underlying distance is APTED
\cite{pawlik2016}, with RTED \cite{pawlik2015} as the algorithmic predecessor the
authors ask to be cited alongside.

Reported evidence is filtered: `MIN_SPAN_NODES = 10` suppresses matches too
small to mean anything, because two one-line functions resemble each other by
virtue of being one line long. The filter applies to the *spans shown to a
reviewer*, not to the similarity figure itself — a distinction worth knowing
before answering a question about it.

## 5.3 Layer 2 — behavioural fingerprinting, in working order

Layer 2 answers a different question: *does this submission resemble its own
author's previous work?* It is the only layer that can see outsourced work,
because it needs no second copy anywhere.

### 5.3.1 Features

The detector's `/features` endpoint extracts **ten** features via
`app/features.py`: `avg_line_length`, `blank_line_ratio`, `comment_density`,
`avg_identifier_length`, `underscore_identifier_ratio`, `avg_function_lines`,
`functions_per_100_lines`, `max_block_depth`, `avg_params_per_function` and
`for_loop_ratio`. All ten are stored on the baseline.

**Four are scored.** `SCORED_FEATURES` in `services/behavioural.ts` is
`blank_line_ratio`, `avg_line_length`, `max_block_depth`, `comment_density`.
Storing all ten keeps the choice reversible.

The justification for choosing those four is **retracted**, and the report must
say so rather than repeat it. The four were selected from a 60-file sample; a
later measurement over 204 Python files across 15 repositories found that the
earlier ranking does not replicate, that `blank_line_ratio` — which had driven
the choice — ranks ninth of ten in Python, and that using every applicable
feature beats the fixed four in both languages. Chapter 7 carries the figures.

### 5.3.2 Anchors and the baseline

`services/anchors.ts` decides which past submissions may describe a student's
style, and `services/baseline.ts` builds the per-student, per-language profile
from them. Eligibility is the first of the five integrity mitigations below.

### 5.3.3 The score, and what its two halves mean

```
z        = (value - mean) / stdDev
stdDev   = max(cohortSpread, VARIANCE_FLOOR[feature])
score    = min(1, rootMeanSquare(z) / Z_SATURATION)      Z_SATURATION = 3
```

The asymmetry here is the project's central idea and the thing most likely to
be misread, including in its own earlier documentation:

- the **numerator** is the student's own trust-weighted mean across their
  anchors;
- the **denominator** is the **cohort's** spread, floored.

A z-score therefore means *how far this submission sits from this student's
usual, measured in units of how much students in this class differ from one
another*. Both halves are load-bearing. An earlier version of this project's
documentation claimed the comparison was "never against the cohort", which is
false and does not survive an examiner opening the file.

The cohort denominator is a measured choice rather than a convenience: a
student's own spread, taken from three or four anchors, is too unstable to
divide by. A student's mean is personal; the spread is closer to a property of
the feature. The variance floor exists because a cohort can produce zero spread
on a coarse feature, and dividing by zero gives infinity.

**The AUC figures previously quoted here are retracted** — 0.766 for a
student's own spread against 0.909 for the cohort's. No measurement script
computes an AUC; see Chapter 7 §7.4. The cohort denominator rests on the
stability argument above, which is reasoning rather than measurement.

### 5.3.4 The five baseline-integrity mitigations

Layer 2's failure mode is not a false negative; it is a wrong baseline accusing
an honest student. Five mitigations exist, and they are a genuine contribution
of the project rather than boilerplate:

1. **Anchor provenance.** Only invigilated work, or work a student nominates and
   faculty accept, may describe their style.
2. **Minimum anchor count.** Below `minAnchorsForBaseline` (3) the layer
   declines to score rather than guessing.
3. **Baseline confidence.** A thin or inconsistent baseline attenuates the
   layer's weight (`effectiveW2`) instead of being trusted at full strength.
4. **Low-variance flag.** A student whose own work varies less than the cohort's
   is penalised by z-scoring, and the result says so.
5. **Cohort saturation flag.** When the pooled spread collapses, every z-score
   is a real difference divided by an invented floor, and the layer has stopped
   discriminating. The result says that too.

Mitigations 2, 3, 4 and 5 all have the same character: the system reports that
it cannot tell, instead of producing a number that looks like an answer. That
is the behaviour an evidence system owes a reviewer.

## 5.4 Layer 3 — specified, justified, and not built

**Layer 3 is not implemented.** This section states the decision and its
reasoning, because an unexplained hole where a third of the architecture should
be is worse than a documented exclusion.

The layer would have detected machine-generated code, following the CodeBERT
fine-tuning approach of Nguyen et al. \cite{nguyen2023, gptsniffer2024}. That
work reports two findings that together make the layer unbuildable *as evidence*
in this setting: classifier performance improves when the training data
resembles the target code, and when snippets are classified in pairs.

A classifier whose accuracy depends on in-distribution training data requires a
labelled corpus of student submissions from the course it will police. No such
corpus exists for this project, and one cannot be manufactured honestly —
generating synthetic "AI-written" submissions and treating them as ground truth
would produce a figure that measures the generator, not the classifier.

The layer could still have been *implemented*. What it could not be is
*characterised*. In a system whose entire premise is auditable evidence, a layer
that emits a number nobody can put a confidence interval on is worse than an
absent layer, because a reviewer has no basis on which to weigh it against the
layers that are measured.

The decision is recorded in the data rather than in a comment. Every detection
result stores:

```
aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" }
```

so that a result read years later says why it has two layers and not three.
Chapter 8 lists the layer as future work with the labelled corpus named as its
precondition.

## 5.5 Composing the Review Priority Score

```
activeWeight = (structuralOk ? w1 : 0) + (behaviouralOk ? effectiveW2 : 0)
RPS          = (w1 * structural + effectiveW2 * behavioural) / activeWeight
```

`services/detection.ts` performs this composition. Three properties of it are
worth a paragraph each in the report, and Figure 5 illustrates them.

**The configured weights are never the applied ones.** The configuration
carries 0.4 / 0.3 / 0.3 across three layers. With Layer 3 absent the divisor is
the sum of the weights of the layers that ran, which is 0.7, so the applied
weights are **0.571 and 0.429**. Quoting 0.4 / 0.3 / 0.3 as the operative
weights would be wrong, and the evidence page renders the renormalisation
explicitly for this reason.

**An absent layer contributes nothing, not zero.** The distinction is not
pedantry. A zero is a finding — it asserts that the layer looked and found
nothing. An absent layer has not looked. Treating absence as zero would drag
every score down by a third and make a two-layer result incomparable with a
three-layer one.

**The weights and threshold are stored on the result.** `effectiveW2` is
Layer 2's weight after attenuation by baseline confidence, and both it and the
review threshold are written onto each `DetectionResult`. A result therefore
remains readable after the configuration changes, which is what makes the
evidence view reproducible from stored data instead of recomputed against
whatever the configuration happens to be when someone opens it.

## 5.6 The queue, and why detection is not synchronous

Detection is slow: it parses, it compares against candidates, and it waits on a
second service. Doing it inside the upload request would make an upload take
seconds and fail under load at precisely the moment every student submits.

`POST /submissions` therefore stores the file, records the submission and
enqueues the work on Redis, **debounced by job identity** (Figure 2, step 4).
Sixty uploads arriving at a deadline collapse into a bounded number of detection
runs rather than sixty, because each run reads the current cohort anyway.

A re-run supersedes rather than replaces: `DetectionResult` carries `isCurrent`
and `revision`, so the superseded result survives. A decision may already have
been recorded against it, and destroying the result would orphan the decision.

## 5.7 The web interface

Ten pages and five shared components in `apps/web`, built between 14 and
26 October. The three worth discussing in the report are:

- **The review queue** — assignments ranked by RPS descending, showing each
  student's name and roll number. The roll number is not decoration: a fixture
  containing two students sharing a surname made it necessary.
- **The evidence page** — the system's actual thesis made visible. It renders
  the caveats *before* the number, the per-feature breakdown, the matched spans,
  and the renormalisation arithmetic. It also **guards its own equation**: it
  recomputes the RPS from the stored weights and, where the recomputation and
  the stored score disagree by more than a small tolerance, refuses to render
  the equation and says the two disagree, rather than printing an identity that
  does not hold.
- **The student's own result view** — status, any recorded decision, and a form
  to answer it. **No score appears anywhere on it**, because the endpoint it
  reads returns none. A ranking a student can read is a ranking a student can
  tune against.

A methodology note belongs in Chapter 6 rather than here, but it originates in
this work: rendering real data through these screens found defects the test
suite had not, and printing them to paper found more. A test asserts a value;
these were things nobody had thought to assert.

## 5.8 What is deliberately not built

Stated here so that the presentation's architecture slides and the delivered
system can be reconciled rather than silently differing:

- **Layer 3**, for the reasons in §5.4.
- **WebSocket push** for queue updates. The queue is polled by the reviewer.
- **Side-by-side AST diff** rendering of two sources. The evidence page reports
  matching line ranges and links to each file; rendering both sources against
  each other needs a diff view that was not built.
- **Multi-file and archive submissions.** One source file per submission.
