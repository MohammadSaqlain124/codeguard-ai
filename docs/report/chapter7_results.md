# Chapter 7 — Results and Discussion

> **Draft status, 14 November 2026.** Every figure below is traceable to a
> committed script in `apps/detector/measurements/`. The one figure that was
> not — an AUC pair quoted in §7.4 — was retracted on 04 November and is
> marked as such in place rather than deleted.
>
> §7.8 reports the Layer 3 measurements, added 14 November. The layer is
> measured but not deployed; §5.4 states the difference.
>
> This chapter reports a **negative result** for the project's headline claim.
> That is deliberate and it is defensible, but §7.10 must be read with the
> project guide before the report is finalised.

---

## 7.1 What was measured, and what was not

Five measurement programmes exist, each a committed and re-runnable script
rather than a recorded number:

| programme | script | what it establishes |
|---|---|---|
| Authorship discrimination | `python_authorship.py`, `java_authorship.py` | whether the style features distinguish authors at all |
| Structural distribution | `structural_floor.py` | how Layer 1 scores honest work by different authors |
| Labelled outsourcing corpus | `style_shift.py` | a corpus of partially outsourced files to test against |
| The ablation and its follow-ups | `ablation.py`, `layer2_direction.py`, `suppression.py`, `independence.py` | whether Layer 2 adds signal beyond Layer 1, and why not |
| Machine-generated code | `collect_human.py`, `ai_corpus.py`, `check_ai_corpus.py`, `baseline_classifier.py` | whether generated code is separable from student code, and at which edit grades |

**What is not measured, and is a standing limitation.** There is no precision or
recall figure for Layer 1 on *known-copied* pairs, because no labelled corpus of
genuine student plagiarism exists. The structural measurement characterises the
distribution over honest work by different authors, which is a different claim
and is reported as such. Manufacturing a labelled corpus of real plagiarism
would be worse than admitting its absence.

## 7.2 Methodology, and how the measurements were validated

This section is unusual in an undergraduate report and it is the strongest thing
in the chapter, so it comes before the results rather than after.

Three days of this project were spent finding errors in its own measurements. A
platform-dependent sort; a single arbitrary sample quoted to three significant
figures; an alias merge applied after the ownership share instead of before; a
lift metric that was never comparable across runs with different author counts.
Several published claims were retracted as a result.

Two permanent features of the measurement scripts exist *because* of those
errors, and that is the right way to present them:

- **Sampling ranges, not point estimates.** Every figure is reported across 25
  draws, because a single sample proved unreliable.
- **Fixed author counts in every comparison table.** Lift is accuracy over
  chance and chance is `1/k`, so lift rises with the number of authors even when
  nothing about the features changed: the same Python data gives **2.43x at 5
  authors and 4.65x at 20**. Any two lift figures quoted side by side must hold
  the author count fixed.

Four errors were found in the ablation study itself during November, all by
reading the code rather than running it, and each had produced output that
looked like a result. They are reported here because the pattern is the finding:

1. The positive control compared the **wrong file** — the corpus recorded the
   donor's author but not the donor file, so the control substituted an
   unrelated file by that author. It would have printed "Layer 1 misses verbatim
   copying", a false statement about the project's own core layer.
2. The chance baseline for precision@k was computed as spliced files over all
   scored files. Because each draw takes one of two versions per pair, chance is
   **0.5 by construction**; the error put it at 0.429 and turned a non-result
   into an apparent thirteen-point lift.
3. Layer 1 was compared against **every** candidate in the pool, while the
   deployed detector shortlists and compares at most ten
   (`MAX_DEEP_CANDIDATES`). Comparing exhaustively credits Layer 1 with matches
   the API cannot make, which biases the study *against* Layer 2.
4. The sign test's verdict was printed without a **direction**. A two-sided test
   fires on any departure from an even split, so "significant" appeared beside a
   result that was significant evidence *against* the hypothesis.

A fifth was methodological: the first stratification bucketed on the *requested*
splice fraction when the corpus documentation states the *actual* fraction is
what an analysis must use. Correcting it did not change the conclusion, which is
the only reason the earlier figures survive.

## 7.3 Layer 1 — structural similarity on honest work

Measured across 15 Python repositories: 1,989 candidate files, 466
single-author, 204 selected across 8 repositories and 27 authors, 100 pairs per
category at seed 0, under production comparison settings.

**Only 8 of the 15 repositories produced any qualifying author.** That is a
sampling fact the chapter states rather than omits, and it bounds how far the
distribution generalises.

**A retraction belongs here.** An earlier claim that Layer 1 similarity has a
floor near 0.5 was retracted. The argument assumed two trees of the same shape
differing only in labels; real unrelated code differs in shape as well, so the
floor does not hold.

## 7.4 Layer 2 — does the style signal distinguish authors?

This is the prior question. If the features cannot tell authors apart at all,
nothing downstream can work.

Corpus: 327 files with **zero parse failures** — Java 123 files, 15 authors, 11
repositories; Python 204 files, 27 authors, 15 repositories.

**The honest headline, stated the way the measurement states it:** across eleven
within-project tests, the features reach roughly **1.4x to 2.5x over chance
where they work at all, and they fail to beat chance in more than half the
projects tested** — five of eleven hold, six do not.

- Strongest: **sympy**, 9 authors, 68 files, **2.51x**, never below 2.12x across
  25 draws.
- Weakest that still matters: **scikit-learn**, 7 authors, 54 files, which does
  not clear chance at all.

Sample size is therefore not the whole story: projects differ in how much
personal style survives their own conventions. Any cross-project figure is
inflated by the repository confound, which accounts for much of it.

**The feature selection is retracted.** The four scored features were chosen
from a 60-file sample on Day 19. Measured over 204 Python files from 15
repositories:

- `blank_line_ratio`, ranked **first at 2.73** in the original sample and the
  reason the four were chosen, ranks **ninth of ten at 1.08** in Python.
- **Nine of ten** features clear F = 1 in Python, not four.
- Using every applicable feature **beats** the fixed four in both languages:
  Python **2.91x to 5.56x**, Java **2.80x to 3.88x**.

A fixed four cannot be right for both languages in any case:
`blank_line_ratio` carries almost no author signal in Python (1.08) while doing
real work in Java (3.34); `comment_density` is the reverse in degree (13.97
against 2.49).

**RETRACTED, 04 November 2026.** An AUC comparison of **0.766** using a
student's own spread against **0.909** using the cohort's was quoted in earlier
project documentation as the evidence for this choice. It is withdrawn. No
script in `apps/detector/measurements/` computes an AUC or an ROC curve at all
— the metrics the measurement programme computes are lift, chance, F ratio,
accuracy and precision — so the figures are reproducible from nothing in the
repository. Their likeliest source is the deleted Day 19 scratch file, which is
the same provenance as the 2.27x and 3.15x figures already retracted for the
same reason.

**The design choice stands on its argument, which is not a measurement and
should not be presented as one.** A student's own spread is estimated from
three or four anchors and is too unstable to divide by; a mean is personal,
whereas a spread is closer to a property of the feature. Establishing the
cohort denominator empirically would need a run that does not yet exist.

## 7.5 The ablation — does Layer 2 add signal beyond Layer 1?

### 7.5.1 The corpus

`style_shift.py` builds the labelled set the earlier measurements lacked. It
takes a file one author owns and replaces some of its top-level functions with
another author's, which is what outsourcing part of an assignment looks like
from outside: the submission is mostly yours and a section of it is not. Both
versions of every file are written, sharing a `pair_id`.

From 466 single-author files, 204 kept after the per-author cap, 27 authors:
**214 pairs written, 155 splices discarded (42%), 24 authors represented.**

| requested fraction | pairs | median actual |
|---|---|---|
| 0.10 | 61 | 0.104 |
| 0.25 | 80 | 0.235 |
| 0.50 | 73 | 0.438 |

Three corpus properties the chapter must state:

- **The 42% discard rate is the honest figure, not a failure.** A splice is
  discarded when the file is too structurally coarse to hit the requested
  fraction, when no donor unit matches the size of what it would replace, or
  when the result no longer parses. Keeping them would mean a bucket labelled
  0.10 containing splices at 0.40.
- **Three of 27 authors produced no usable pair**, so the corpus is biased
  toward authors whose files are structurally amenable to splicing.
- **214 pairs come from only 94 distinct source files.** Eighty-one sources were
  reused across the three fractions, producing byte-identical clean copies. The
  statistics are therefore **stratified by fraction**, within which each source
  appears at most once. **Ninety-four, not 214, is the number every figure below
  rests on.**

The length confound was controlled by size-matching donor units to within 30% of
what they replace. The control worked: median length delta is **−1 line**, and
the measured correlation between absolute line delta and the RPS delta is
**−0.131**, under 2% of variance and negative. Detection is not tracking file
size.

### 7.5.2 The positive control, which passes

With the donor's own file inside Layer 1's pool — a verbatim copy the system can
see — Layer 1 behaves exactly as it should:

| splice fraction | Layer 1 gap | paired sign test | precision@10 |
|---|---|---|---|
| 0.10 | +0.0150 | 42 of 60, p = 2.67 × 10⁻³ | 0.700 |
| 0.25 | +0.0335 | 53 of 80, p = 4.87 × 10⁻³ | 0.800 |
| 0.50 | +0.0706 | 47 of 73, p = 1.86 × 10⁻² | **1.000** |

Monotonic in how much was copied, significant at every fraction, and perfect
ranking at the top ten when half the file is someone else's. Layer 2's figures
are byte-identical between the two conditions, as they must be, since the donor
never enters Layer 2's computation.

**This is what licenses the negative result below.** The apparatus demonstrably
detects what it is supposed to detect.

### 7.5.3 The result, donor excluded — the actual thesis test

This is the threat model: outsourced work with no second copy in the cohort.

| splice fraction | Layer 1 gap | Layer 2 gap | precision@10, L1 | precision@10, L1+L2 |
|---|---|---|---|---|
| 0.10 | +0.0095 | **−0.0124** | 0.500 | 0.500 |
| 0.25 | +0.0088 | **−0.0176** | 0.700 | **0.400** |
| 0.50 | −0.0006 | **−0.0090** | 0.700 | 0.500 |

Chance is 0.500 by construction.

Three statements, all negative:

1. Layer 2 scores **lower** on spliced files than on clean ones at every
   fraction. That is the wrong direction, not merely a small effect.
2. Adding Layer 2 to Layer 1 **degrades** ranking precision at every fraction,
   falling below chance at 0.25.
3. There is **no dose-response**. Measured continuously against the actual
   splice fraction rather than a bucket: **+0.022** for Layer 2.

## 7.6 Why Layer 2 fails, and it is structural

Two diagnostics separate the possible causes.

### 7.6.1 The features do move

`suppression.py` measures how far there was to move against how much of that
move happened. **Reach** is the donor-to-target distance in cohort standard
deviations; **realisation** is the fraction of the predicted displacement that
actually occurred.

| feature | median \|reach\| | median realisation |
|---|---|---|
| `blank_line_ratio` | 0.945 | **0.997** |
| `avg_line_length` | 0.905 | **0.907** |
| `comment_density` | 0.590 | **0.893** |
| `max_block_depth` | 0.694 | **−0.000** |

Predicted against observed displacement, in standard deviations:

| requested fraction | median \|predicted\| | median \|observed\| |
|---|---|---|
| 0.10 | 0.085 | 0.062 |
| 0.25 | 0.182 | 0.254 |
| 0.50 | 0.365 | 0.443 |

So the donors genuinely differ from the targets, and for three of the four
features the simple mixing model holds almost exactly. **The corpus is not
suppressing the signal.** The fault is in the feature set and the score.

### 7.6.2 An rms distance is direction-blind

The score is `min(1, rms(z) / Z_SATURATION)` — a **magnitude** of deviation from
the student's own baseline. The splice displaces a file by about 0.44 standard
deviations per feature at the half-replaced fraction. But the direction of that
displacement is set by where the donor happens to sit relative to the student,
which is arbitrary across pairs.

A point already 0.55 to 0.90 standard deviations from its baseline, displaced
0.44 in an arbitrary direction, moves **closer** to the baseline about as often
as further from it. The measurement confirms it: at the half-replaced fraction,
|z| grew in **37 of 73** pairs for `blank_line_ratio`, **38 of 73** for
`avg_line_length` and **37 of 68** for `comment_density`. Coin flips. That is
why the gaps in §7.5.3 are slightly negative rather than merely small.

`Z_SATURATION = 3` clamps **zero** pairs, so saturation hides nothing; the
layer's usable range on this corpus is roughly 0.18 to 0.30 out of nought to one.

### 7.6.3 A maximum is not a mixable statistic

`max_block_depth` has reach 0.694 — donors do differ on it — yet realisation is
exactly **−0.000**: the splice usually does not change it at all. Replacing some
functions cannot lower a maximum unless the deepest is replaced, and a donor's
function raises it only if it is deeper. It is tied in **57 of 61** pairs at the
0.10 fraction. Its realisation upper quartile is 2.250, so when it does move it
overshoots wildly.

Neither failure is a tuning problem. Both say the same thing: **a whole-file
magnitude cannot detect a partial, signed substitution.**

### 7.6.4 The arbitrary direction, measured directly

The claim above — that the donor's position relative to the student is
arbitrary across pairs — was initially inferred from the coin-flip counts in
§7.6.2. `suppression.py` now measures it, reporting the **sign** of reach and
not only its magnitude:

| feature | donor above target | of | share | p |
|---|---|---|---|---|
| `blank_line_ratio` | 102 | 214 | 0.477 | 0.54 |
| `avg_line_length` | 107 | 214 | **0.500** | 1.00 |
| `max_block_depth` | 85 | 174 | 0.489 | 0.82 |
| `comment_density` | 96 | 208 | 0.462 | 0.30 |

All four are indistinguishable from a coin flip, and `avg_line_length` is
exactly half. The displacement a splice applies therefore has a magnitude the
mixing model predicts and **a sign that carries no information** — which is
precisely the condition under which a distance from a baseline cannot detect it.

The account in §7.6 is consequently measured at every link rather than argued at
any of them: the donors differ (reach), the direction of that difference is
arbitrary (this table), and the splice realises the predicted displacement
(realisation). A magnitude applied in an arbitrary direction to a point already
off centre moves it closer about as often as further away, and the paired counts
in §7.6.2 show exactly that.

## 7.7 Layer independence

The RPS adds the layers with fixed weights, which presumes each says something
the other does not. Measured from the saved per-item scores: Pearson **−0.042**
across all 428 scored files, about −0.04 within each class, Spearman within
±0.11 everywhere.

The weighting assumption therefore holds. It should be read carefully rather
than as a vindication: **two signals are also uncorrelated when one of them is
noise.** Independence is necessary for the composition to make sense; it is not
by itself evidence that combining the layers helps. On this corpus, §7.5.3 shows
it does not.

## 7.8 Layer 3 — machine-generated code, measured

Chapter 5 §5.4 records why Layer 3 went unbuilt for most of this project: the
published approach depends on training data that resembles the submissions it
will police, and no such corpus existed. That objection was answered by
building the corpus rather than by assuming one, and the layer has now been
measured. It is **not deployed** — §5.4 explains what is and is not wired into
the detection path — but the question of whether it works is no longer open.

### 7.8.1 The corpus, and one serious false start

The first attempt reused the 214-pair splice corpus from §7.5. That corpus is
CPython standard library code, which is appropriate for asking whether a splice
is detectable and wholly inappropriate here. A classifier given library code as
its human class and generated code as its AI class separates twenty years of
committee-edited library source from freshly written single-purpose modules.
It would have scored well and measured nothing about authorship. The median
file length alone makes the mismatch plain: **444 lines for the standard
library against 98 for student coursework**.

The human class was rebuilt from scratch. `collect_human.py` clones public
GitHub repositories tagged as coursework, mini-projects and student projects,
and keeps a file only if **that file's own last commit** predates 1 January
2023. Repository age is not sufficient — a 2019 repository can hold a file
edited in 2024 — so the filter asks git for each candidate individually. The
result is 96 files from 25 repositories, last-commit dates spanning
2017-02-28 to 2022-11-30, with per-file provenance recorded in a manifest.

The AI class is 60 files generated to match the human corpus on two axes.

**Task mix**, so the classifier cannot separate the classes by subject matter:

| share | task type |
|---|---|
| 28% | computer vision and machine-learning coursework |
| 23% | networking, bots and scraping |
| 21% | tools, editors, calculators |
| 14% | CRUD systems with a GUI and a database |
| 7% | games |
| 7% | algorithms |

**Surface style**, which matters more than it appears to. Language models
produce docstrings and type hints on almost everything, while the human corpus
carries module docstrings on 11% of files, function docstrings on 33% and type
hints on 11%. Left alone, those four traits separate the classes almost
perfectly and a classifier learns formatting rather than authorship. Each
prompt therefore carried an explicit style instruction drawn at the human
corpus's own rates, and `check_ai_corpus.py` verified every generated file
against what its prompt asked for. Two files in fifty ignored the instruction
and were corrected; models are not reliable about this.

### 7.8.2 Matched preprocessing, and why the control is not a deduction

`ai_corpus.py` builds three edit grades: **raw** model output, **disguised**
output with identifiers renamed and comments and docstrings stripped, and
**mixed**, one generated function spliced into an otherwise human file at a
minimum AI share of 0.10.

Grade 2 carries a trap. If only the AI class is disguised, the stripped
comments and `v0, v1, v2` identifiers appear in exactly one class by
construction, and the classifier wins by detecting the transformation. On an
early run with deliberately falsified labels this produced **100% recall on
grade 2 that meant nothing at all**.

The fix is matched preprocessing: a disguised copy of every human file is added
to the human class, so the transformation appears on both sides and cannot act
as a class cue. With matching in place and the labels still falsified, grade-2
recall fell to **0%** — the correct answer when there is nothing to find, and
the negative control the rest of this section rests on.

A control measurement accompanies every run, training on plain human code
against disguised human code. Both classes are human-written, so the figure is
purely how detectable the transformation is in isolation: **0.8543**. An
earlier version of the measurement script instructed the reader to subtract
that from the grade-2 result. **That instruction was wrong and has been
removed.** Once preprocessing is matched the disguise sits in both classes and
cannot inflate anything; the control states why matching was necessary, not how
much of the result is artifact.

### 7.8.3 The result

351 items in 102 groups, split 233 train and 118 test. Items derived from one
source file are the same program in three disguises, and a mixed file is mostly
its human host, so whole groups are held out rather than individual files.

| measure | value |
|---|---|
| ROC AUC, overall | **0.9521** |
| specificity — human files left unflagged | 41 / 44 (93.2%) |
| recall, grade 1 — raw generated output | 22 / 25 (88.0%) |
| recall, grade 2 — disguised | 20 / 25 (80.0%) |
| recall, grade 3 — one function spliced in | **9 / 24 (37.5%)** |

**The grade-3 figure is the result.** Wholesale generation is caught most of
the time; partial insertion is caught barely more often than a coin would
manage. The classifier sees a file as one bag of n-grams, so a single generated
function is diluted by the human host surrounding it.

That is the same failure, reached independently, as §7.5.3 and §7.6: Layer 2
could not see a partial substitution either, for reasons that were structural
rather than fixable. **Two layers, two methods, two corpora, one conclusion** —
this class of detector catches wholesale substitution and misses partial
substitution. The agreement is worth more than the headline figure, because it
is a statement about the problem rather than a score for an implementation.

### 7.8.4 Two confounds tested and rejected

A figure of 0.95 invites the question of what else it could be measuring. Two
candidates were checked.

**Era.** The human corpus is 2017–2022 and the AI corpus is 2026. If Python
idiom moved in that window, the classifier could be separating dates rather
than authors. Measured across 47 human and 60 generated files:

| marker | human | generated |
|---|---|---|
| f-strings | 17% | 25% |
| type hints | 9% | 12% |
| `pathlib` | 2% | 2% |
| walrus `:=` | 0% | 0% |

No meaningful gap. The students wrote structurally modern Python, and this
explanation is rejected.

**Boilerplate.** `if __name__ == "__main__"` appears in 82% of AI items and 32%
of human items, and reaches **AUC 0.7499 on its own** — a single line, trivially
added or deleted by anyone wishing to evade detection. The full model scores
0.9521 with it present and **0.9616 with it removed entirely**. With 118 test
items the standard error on an AUC is roughly 0.025, so those two figures are
indistinguishable: the feature contributes nothing either way, and the result
does not rest on it.

### 7.8.5 What is not claimed

- **CodeBERT is untrained.** `train_codebert.py` exists, its non-model
  components are unit tested, and its training loop has never executed. Every
  figure above belongs to the logistic-regression baseline. **No CodeBERT
  accuracy is claimed anywhere in this report.**
- **The generated class is dominated by one model.** 40 of 60 files came from
  one assistant and 20 from others. Generalisation to other generators is
  untested.
- **The generated files use `%` string formatting far more than is natural** —
  19% of human files against 55% of generated ones — because the author chose
  that style while producing them, to avoid an obviously generated look. This
  is not natural model output. Its direction makes the task harder rather than
  easier, so it does not inflate the result, but it is an artifact introduced
  by the corpus author and is disclosed here rather than left to be found.
- **Grade-3 hosts come from a narrow pool.** Only 21 of 96 human files have
  enough top-level functions to host a splice, so 54 mixed items draw on 21
  hosts.
- **The corpus is small.** 351 items, 102 groups, and each per-grade recall
  rests on 24 or 25 test items. Every figure carries wide error bars.
- **Python only**, as with the ablation in §7.5.
- **One file is unaccounted for.** The collector wrote 97 files and the corpus
  builder found 96 usable, under what should be identical filters. The
  discrepancy is unexplained and is recorded rather than quietly absorbed.

## 7.9 Limitations

1. **No labelled corpus of genuine plagiarism.** All structural figures describe
   honest work by different authors.
2. **94 independent units, not 214.** Stated at every figure in §7.5.
3. **Open-source library code, not coursework.** Repository conventions are a
   confound, and the within-project figures are the defensible ones.
4. **Corpus biased toward splice-amenable files**; 3 of 27 authors produced none.
5. **One language.** The ablation ran on Python only. The authorship measurement
   covers both, and the two features most affected behave oppositely across
   them, so the ablation should not be assumed to transfer to Java.
6. **Layer 3 measured but not deployed.** The renormalisation is always
   active in the running system, so the three-layer design remains untested as
   a three-layer design even though Layer 3 now has figures of its own (§7.8).
7. **Discrimination is not detection.** §7.4 shows the features carry some
   author signal; §7.5 shows that signal does not survive partial substitution.
   The two are not in conflict — identifying a whole file's author is a
   different task from noticing that a fraction of it changed hands — and the
   report must keep them separate.

## 7.10 What this means for the project's claim

Layer 2 is the only layer that can see outsourced work with no second copy
anywhere. That capability is what distinguishes this project from a clone
detector, and **the one corpus built to test it does not support it.**

The honest statement of the contribution is therefore narrower than the one the
project set out with, and it is still a real contribution:

- a working two-layer evidence system with renormalised, auditable scoring and
  stored evidence;
- five baseline-integrity mitigations that make the system report *that it
  cannot tell* rather than emit a number that looks like an answer;
- a reproducible measurement programme that establishes where the behavioural
  approach works (author discrimination, within project, 1.4x to 2.5x where it
  works at all) and where it does not (partial outsourcing, not at all);
- a diagnosis of *why* it does not, precise enough to name the fix: per-unit
  rather than whole-file features, and a signed rather than magnitude
  comparison, so that moving *toward* another author's typical values is itself
  the signal.

That last item is a design change and not a reweighting, and it is future work.

> **Action required before the report is finalised.** The project's claimed
> research novelty, as stated in the presentation and in Chapter 1, asserts
> behavioural detection of outsourced work. §7.5 does not support that assertion.
> **This must be reworded in consultation with the project guide, Mr. Ashish
> Sharma, and not unilaterally.** Chapter 2 §2.7 carries the same flag. A
> negative result with a mechanism and a named fix is a defensible final-year
> outcome; an overclaim contradicted by the project's own committed measurement
> script is not.
