# Measurements

Scripts that produce the numbers the report quotes. A measurement nobody can
re-derive is an anecdote, not evidence, so anything cited belongs in here.

```
common.py              everything both authorship measurements share
java_authorship.py     the Java repository list and file filters
python_authorship.py   the Python repository list and file filters
structural_floor.py    what Layer 1 scores for code nobody copied
```

The two language scripts are configuration only. All the selection,
attribution, statistics and reporting live in `common.py`, so "the same method
applied to both languages" is literally the same code rather than two
descriptions that can drift apart. Features come from
`app.features.extract_features` directly rather than a replica, so nothing can
disagree with the running service. `app/features.py` is already
language-agnostic: it unions every language's node labels instead of branching,
which is why one extractor serves both.

The detector's dependencies live in its own virtualenv, so bare `python` will
not find tree_sitter. Activate it first, or call its interpreter directly.
`--work` is a real directory and these are the ones the October 2026 runs
used, not the Unix-looking paths an earlier version of this file printed:

```
cd apps/detector
.\.venv\Scripts\Activate.ps1
python measurements/java_authorship.py   --work E:\temp\javarepos --skip-clone
python measurements/python_authorship.py --work E:\temp\pyrepos  --skip-clone
python measurements/structural_floor.py  --language python --work E:\temp\pyrepos --skip-clone
```

`structural_floor.py` also takes `--language`, `--pairs` to trade precision for
time, and `--min-lines`/`--max-lines`. Run it twice, once over the whole band
and once restricted to 30-120 lines, because the score depends strongly on file
size and 30-120 is the size a real submission is.

`--skip-clone` reuses a work directory you already have. `--save FILE` writes
the measured features as JSON. `--seed N` chooses which sample of files the
per-author cap keeps. `--draws N` re-runs everything on N samples and reports
how much each figure moves; it defaults to 25 and is the part worth reading.

**Cost.** Full history is required, because `git blame` on a shallow clone
attributes every line to the boundary commit. Java: 11 repositories, 655 MB.
Python: 15 repositories, 923 MB. Budget 3x that and do not start below 25 GB
free. Blame runs at roughly 70 ms per file, so attribution takes two to three
minutes; the 25 draws add well under a minute because every file is parsed once
and cached across draws.

---

## Read this before quoting any figure

**Lift is accuracy divided by chance, and chance is 1/k where k is the number of
authors. So lift grows with the number of authors in the sample even when
nothing about the features has changed.** On the Python data, the identical
features and the identical code score:

| authors | accuracy | lift |
|---|---|---|
| 5 | 48.6% | 2.43x |
| 8 | 37.9% | 3.03x |
| 10 | 32.9% | 3.29x |
| 14 | 26.9% | 3.76x |
| 20 | 23.2% | 4.65x |

Accuracy falls and lift rises, on one dataset. A bare lift therefore says more
about how many authors were in the sample than about how well the features
work, and **no two runs with different author counts are comparable.** That
retrospectively invalidates every cross-run comparison made before 07 October,
including the Day 19 figures of 2.27x and 3.15x and the Java figure of 3.88x.
Both scripts now print the table above, and it is the only cross-language
comparison that means anything.

---

## The headline: the two languages are the same

At matched author counts, medians over 25 draws:

| authors | Java accuracy | Java lift | Python accuracy | Python lift |
|---|---|---|---|---|
| 5 | 47.8% | 2.39x | 48.6% | 2.43x |
| 8 | 39.1% | 3.13x | 37.9% | 3.03x |
| 10 | 34.1% | 3.41x | 32.9% | 3.29x |
| 14 | 27.7% | 3.88x | 26.9% | 3.76x |
| 20 | too few authors | | 23.2% | 4.65x |

Every gap is 0.12x or less, inside the draw-to-draw noise. **Layer 2's features
separate authors equally well in Java and in Python.** This is the one sentence
the report should carry about language portability, and it replaces the Day 18
and Day 19 speculation that Java would be weaker because the grammar exposes
fewer features.

## The samples

| | Java | Python |
|---|---|---|
| repositories | 11 | 15 |
| candidate files (30-700 lines, no tests) | 1397 | 1989 |
| one author owns >= 85% of lines | 769 | 466 |
| distinct authors | 57 | 154 |
| authors with >= 4 files | 15 | 27 |
| files measured (cap 12 per author) | 123 | 204 |
| parse failures | 0 | 0 |

Zero parse failures in 327 files of real library code across both grammars is
the most reassuring number in the whole exercise.

Note the ownership rows. Only 23% of candidate Python files have a single 85%
owner against 55% of Java files: mature Python libraries have been edited by too
many hands for one author to own a file. The first Python attempt used eleven
famous repositories and produced only nine eligible authors, none of them with
more than two co-eligible authors in the same project. The four added
afterwards (sympy, scikit-learn, faker, aiohttp) are modular enough that
individuals own whole subpackages, which is what finally produced a
within-project test worth running.

## Authors inside one project, which is what Layer 2 actually does

Layer 2 always compares a student against their own earlier work inside one
course, so project conventions are held constant there exactly as they are
inside one repository. Cross-repository figures are confounded: every author in
a sample like this writes in one project, so "which author" and "which project"
are the same question. Predicting the repository scores 3.46x in Java and 2.51x
in Python, which is most of the cross-repository author figure.

Medians over 25 draws, the four features `behavioural.ts` scores:

| project | language | authors | median | range | verdict |
|---|---|---|---|---|---|
| sympy | Python | 9 | **2.51x** | 2.12x to 2.78x | holds |
| metrics | Java | 5 | **2.16x** | 1.62x to 2.57x | holds |
| aiohttp | Python | 2 | 1.67x | no spread | holds |
| gson | Java | 2 | 1.64x | no spread | holds |
| scikit-learn | Python | 7 | 1.43x | 0.91x to 1.69x | **chance** |
| celery | Python | 2 | 1.37x | 1.05x to 1.68x | holds |
| zxing | Java | 3 | 1.30x | 0.78x to 1.83x | **chance** |
| jackson-core | Java | 2 | 1.12x | 0.62x to 1.50x | **chance** |
| mitmproxy | Python | 2 | 1.12x | 0.50x to 1.50x | **chance** |
| scrapy | Python | 2 | 0.89x | 0.33x to 1.33x | **chance** |
| django | Python | 2 | 0.60x | no spread | **chance** |

**Five of eleven hold and six do not.** sympy is the strongest evidence either
language produced: nine authors, 68 files, 2.51x and never below 2.12x across
25 draws. But scikit-learn with seven authors and 54 files does not clear
chance, so sample size is not the whole story: projects differ in how much
personal style survives their own conventions.

**The honest operational sentence: within one project the features reach roughly
1.4x to 2.5x where they work at all, and they fail to beat chance in more than
half the projects tested.** That is the figure the report should carry, and it is
far more sober than Day 19's 2.27x and 3.15x.

## The feature ranking, and a problem for File 075

F ratio is between-author variance over within-author variance; above 1.0 means
the feature separates authors. Ranked by the Python measurement, with the Java
value and the Day 19 claim beside it. **Bold** marks the four `behavioural.ts`
currently scores.

| feature | Python F | Java F | Day 19 claim | applies (Py / Java) |
|---|---|---|---|---|
| **comment_density** | **13.97** | 2.49 | 1.21, 4th | 100% / 100% |
| avg_params_per_function | 5.84 | 1.34 | 0.14, 10th | 93.6% / 97.6% |
| avg_function_lines | 4.60 | 1.33 | 0.46, 6th | 93.6% / 97.6% |
| avg_identifier_length | 4.58 | 3.24 | 0.18, 9th | 100% / 100% |
| underscore_identifier_ratio | 3.90 | 11.43 | 0.17, 9th | 100% / 100% |
| functions_per_100_lines | 3.24 | 3.52 | 0.56, 5th | 100% / 100% |
| **max_block_depth** | 2.50 | 1.80 | 1.94, 3rd | 100% / 100% |
| **avg_line_length** | 2.14 | 3.96 | 2.11, 2nd | 100% / 100% |
| **blank_line_ratio** | 1.08 | 3.34 | 2.73, **1st** | 100% / 100% |
| for_loop_ratio | 0.90 | 0.90 | 0.26, 7th | 59.8% / 27.6% |

**Day 19's ranking does not replicate on its own language.** `blank_line_ratio`,
which Day 19 made the top feature at 2.73 and which drove the choice of the four
scored features, comes ninth of ten at 1.08 on a sample three times the size.
The two naming features Day 19 ranked last at 0.17 and 0.18 come fourth and
fifth. Day 19 ran on 60 files from 7 repositories, this runs on 204 files from
15, and Day 19's script was deleted, so the disagreement cannot be diagnosed
directly. On every ground that can be checked, this measurement supersedes it.

**And the chosen four are beaten by simply using everything that applies**, in
both languages:

| | the four scored | all applicable | authors |
|---|---|---|---|
| Java | 2.80x | **3.88x** | 14 |
| Python | 2.91x | **5.56x** | 27 |

So the fixed set of four costs real accuracy. The simplest change that both
languages support is for `behavioural.ts` to score every feature that applies
to the submission rather than a fixed four. That is a decision about Layer 2's
scoring and is recorded in `docs/PROJECT_NOTES.md` as open, not made here.

One caution if the four are kept: `blank_line_ratio` carries almost no author
signal in Python (1.08) while doing real work in Java (3.34), and
`comment_density` is the reverse in degree (13.97 against 2.49). A fixed
four cannot be right for both languages.

## Size bands do not help, in either language

`SIZE_BAND_LOW` and `SIZE_BAND_HIGH` came from Day 19 deriving an 80-250 line
band on Python files. Medians over 25 draws, against the unbanded figure for the
same features:

| band | Java | Python |
|---|---|---|
| unbanded | 3.88x | 5.56x |
| 80-250 | 3.18x | 3.86x |
| 50-150 | 3.53x | 4.70x |
| 40-120 | 3.87x | 4.48x |
| 30-100 | 3.44x | 4.10x |

**No band beats leaving the band off, in either language.** Every one is marked
`no better` by the script. `behavioural.ts` is unaffected in its current form
because its band is a ratio of the submission's own line count rather than an
absolute range, but the idea that an absolute size window improves author
separation is not supported by either measurement.

## `for_loop_ratio` and the None rather than zero rule

It applies to 59.8% of real Python files and 27.6% of real Java files, and its F
ratio is 0.90 in both: it is the only feature that fails to separate authors in
either language, and it is the only sparse one. Writing zero rather than null
would fabricate a measurement in 40% of Python files and 72% of Java files. The
rule is vindicated; the feature itself earns nothing and is a candidate for
removal.

## Caveats

Two-author within-project tests are nearly meaningless and five of the eleven
are two-author. This is library code written by professionals over years, not
student coursework. Classification is a proxy for the anomaly detection Layer 2
actually performs: it answers "whose file is this" rather than "is this file
unlike that student's others". The 25 draws measure sensitivity to the
per-author cap only; they say nothing about the choice of repositories, the 85%
ownership threshold or the 30-700 line bounds, any of which could matter as
much. And the Python ownership rate of 23% means the Python sample is drawn from
a narrower, more unusual slice of its candidates than the Java one.

## What the Day 19 entry still owes

Its 2.27x and 3.15x came from a deleted scratch file. They are now superseded
rather than reproduced: this measurement is larger, confound-controlled,
reports ranges, and holds the author count fixed when comparing. The Day 19
entry in `docs/PROJECT_NOTES.md` carries dated amendments pointing here.

---

## The style-shift corpus

Every measurement above answers *whose file is this*. Layer 2 answers *is this
file unlike the other files this student wrote*, which is anomaly detection
against one person's own history. The caveats below already admit the gap:
classification is a proxy for the job the layer actually does, and until now
there was no labelled outsourced work to test it on.

`style_shift.py` builds that labelled set. It takes a file one author owns and
replaces some of its top-level functions with another author's, which is what
outsourcing part of an assignment looks like from outside: the submission is
mostly yours and a section of it is not. Both versions of every file are
written, sharing a `pair_id`.

```
cd apps/detector
.\.venv\Scripts\Activate.ps1
python measurements/style_shift.py --language python --work E:\temp\pyrepos \
    --skip-clone --out E:\temp\splices --rows-cache E:\temp\pyrepos-attribution.json
```

`--rows-cache` saves the git blame pass, which is two to three minutes and
does not depend on `--seed` or `--fractions`. Reuse it while tuning either.

### The 30 October run, Python, seed 0

| | |
|---|---|
| single-author files | 466 |
| kept after the per-author cap | 204 |
| authors in the sample | 27 |
| pairs written | 214 |
| splices discarded | 155 |
| authors represented in the corpus | 24 |

| requested fraction | pairs | median actual |
|---|---|---|
| 0.10 | 61 | 0.104 |
| 0.25 | 80 | 0.235 |
| 0.50 | 73 | 0.438 |

**Length delta, spliced minus clean: median -1 line, range -68 to +24.**

That median is the confound control reporting success. Three of Layer 2's
features are length-sensitive — `avg_function_lines`, `functions_per_100_lines`
and `avg_line_length` — so a corpus whose spliced files were systematically
shorter would let the layer appear to detect outsourcing while actually
detecting that the file shrank. Donor units are size-matched to within 30% of
what they replace, and a median of one line says that worked in aggregate.

**It does not say it worked for every pair.** The range runs to -68 lines, so
individual pairs carry real length differences even though the population does
not. Anyone reporting a detection result from this corpus should check whether
detection correlates with the absolute length delta, and say so. A median near
zero rules out systematic bias, not per-case confounding.

### What the discards mean

42% of attempted splices were thrown away, and that is the honest figure rather
than a failure. A splice is discarded when the file is too structurally coarse
to hit the requested fraction — you cannot replace 10% of a file whose smallest
top-level function is 22% of it — or when no donor unit matches the size of
what it would replace, or when the result no longer parses. Keeping those would
mean a bucket labelled 0.10 containing splices at 0.40, and a corpus padded
with files the detector cannot read.

The 0.50 bucket undershoots at 0.438. Units are coarse and the tolerance allows
it; the actual fraction is recorded per item and is what the analysis should
bucket on, not the requested one.

Three of the 27 authors produced no usable pair at any fraction. **The corpus
is therefore biased toward authors whose files are structurally amenable to
splicing**, which is not the same population as the 204-file sample above.

### One choice left open on purpose

Each file is emitted twice, clean and spliced, sharing a `pair_id`. A paired
analysis is statistically stronger; it also puts near-identical content into
one run twice, which can leak. The manifest supports either. Whichever the
ablation uses, it has to say which.

## The ablation: does Layer 2 add signal beyond Layer 1?

`ablation.py`, run 01 November 2026 on the 214-pair Python style-shift corpus
above. Per-item scores saved to `ablation-python.json`; the follow-up analyses
in `independence.py` and `suppression.py` read that file rather than repeating
the run, which takes forty minutes on a sixteen-thread laptop.

```
cd apps/detector
.\.venv\Scripts\Activate.ps1
python measurements/ablation.py --corpus E:\temp\splices --language python \
    --pool 50 --draws 25 --save E:\temp\ablation-python.json
python measurements/independence.py --scores E:\temp\ablation-python.json
python measurements/suppression.py --corpus E:\temp\splices
```

`--pool` is capped at 50 because `MAX_CANDIDATES = 50` in `app/main.py` is the
most the detector endpoint accepts; a larger pool measures a system that cannot
run. Pool size only feeds the cheap label-bag ranking, so 50 costs no more than
20: the expensive tree comparison is capped at `MAX_DEEP_CANDIDATES = 10` per
file, matching what `app/main.py` actually does.

### Answering the choice this file left open

The section above asked which analysis the ablation would use, paired or
cohort, and said it had to say which. **It uses both, and they answer different
questions.** The paired analysis takes the difference between the two versions
of the same file and runs an exact two-sided sign test, which is the stronger
test and the one that controls for everything about the file except the splice.
The cohort analysis draws exactly one version of each pair per draw, 25 draws,
and reports precision@k — which is what a reviewer's queue actually looks like,
and where no file can appear twice.

Chance in the cohort analysis is **0.5 by construction**, not something to
measure: one of two versions per pair means a random ranking puts a spliced file
in the top k half the time whatever the corpus holds.

### The corpus has 214 pairs and 94 independent units

Not recorded above, and it should have been. Eighty-one of the 94 distinct
source files were reused across the three splice fractions, so the same clean
file is written up to three times under different pair ids, byte-identical each
time. Pooling all 214 pairs hands a sign test up to three copies of one file and
an n it has not earned.

The analysis is therefore stratified by splice fraction — 61, 80 and 73 pairs —
within which each source file appears at most once. **Ninety-four is the number
any reported statistic rests on.**

### The result

Donor excluded, which is the thesis test and matches the threat model of
outsourced work with no second copy in the cohort:

| splice fraction | Layer 1 gap | Layer 2 gap | precision@10 L1 | precision@10 L1+L2 |
|---|---|---|---|---|
| 0.10 | +0.0095 | **-0.0124** | 0.500 | 0.500 |
| 0.25 | +0.0088 | **-0.0176** | 0.700 | **0.400** |
| 0.50 | -0.0006 | **-0.0090** | 0.700 | 0.500 |

Layer 2 scores *lower* on spliced files than on clean ones at every fraction,
which is the wrong direction, and adding it to Layer 1 degrades precision@10
every time, below chance at 0.25. No dose-response.

Donor included, the positive control, with the donor's own file inside Layer 1's
pool:

| splice fraction | Layer 1 gap | paired sign test | precision@10 L1 |
|---|---|---|---|
| 0.10 | +0.0150 | 42 of 60, p = 2.67e-03 | 0.700 |
| 0.25 | +0.0335 | 53 of 80, p = 4.87e-03 | 0.800 |
| 0.50 | +0.0706 | 47 of 73, p = 1.86e-02 | **1.000** |

The control passes and rises monotonically with how much was copied. Layer 2's
figures are byte-identical across the two conditions, as they must be since the
donor never enters its computation. **The harness measures what it claims to**,
which is the reason the negative result above is worth reporting rather than
dismissing as a broken rig.

### Why Layer 2 does not move

`layer2_direction.py` takes the four scored features one at a time. Even at the
half-replaced fraction they barely move:

| feature | raw, clean | raw, spliced | pairs tied |
|---|---|---|---|
| `blank_line_ratio` | 0.1986 | 0.2069 | 0 of 73 |
| `avg_line_length` | 38.891 | 38.181 | 0 of 73 |
| `max_block_depth` | 3.6849 | 3.6575 | **33 of 73** |
| `comment_density` | 0.0162 | 0.0154 | 5 of 73 |

Nothing significant at any fraction. `Z_SATURATION = 3` clamps **zero** pairs,
so saturation is not hiding movement; the usable range of Layer 2 on this corpus
is roughly 0.18 to 0.30 out of nought to one.

All four scored features are whole-file aggregates — two ratios, a mean and a
maximum — and averaging over a whole file is what destroys a signal carried by
part of it. `max_block_depth` is worst for this task because it is a maximum:
one surviving deeply nested function pins it, which is why it ties in 57 of 61
pairs at fraction 0.10.

**The proposed mechanism is not yet verified.** A mixing model says a file that
is fraction *f* another author's should land near (1-f) times the student's
typical value plus *f* times the donor's, giving a deviation of about *f* times
the between-author difference, against a denominator that is itself the scale on
which authors differ — so the earnable deviation is bounded near one while the
clean files' own baseline |z| already sits at 0.55 to 0.90. Observed movement is
smaller even than that bound predicts, so something further is suppressing it.
`suppression.py` separates the two possibilities by measuring **reach** (how far
there is to move, in cohort standard deviations) against **realisation** (how
much of the predicted move happened). Near-zero reach indicts the feature set;
near-zero realisation indicts the corpus construction, in which case this null
result is partly an artifact and must say so.

### Three checks closed from the saved scores

`independence.py`, 02 November. None of these needed the forty-minute run
repeated.

**Layer 1 and Layer 2 are independent.** Pearson -0.042 over all 428 scored
files, about -0.04 within each class, Spearman within ±0.11 everywhere. The RPS
weights the layers separately on the premise that each says something the other
does not, and nothing here contradicts it. Read with care: two signals are also
uncorrelated when one is noise, so independence is necessary for the composition
to make sense and is not by itself evidence that combining them helps.

**No dose-response against `actual_fraction`, measured continuously.** Pearson
+0.022 for Layer 2, -0.054 for Layer 1, -0.032 for the RPS. This matters because
this file says plainly that the requested fraction is a design label and the
actual one is what an analysis should bucket on — and the stratification shipped
on 01 November bucketed on the requested one. The buckets do overlap: requested
0.25 spans actual 0.127 to 0.371, requested 0.50 spans 0.251 to 0.747.
**Correcting it does not change the conclusion**, which is the only reason the
01 November figures survive. `ablation.py` now prints each stratum's actual
range so the overlap is visible on the face of the output.

**The length confound is clear.** This file asked anyone reporting a detection
result from the corpus to check whether detection tracks the absolute length
delta. It does not: |delta lines| against delta RPS is **-0.131**, under 2% of
variance, and negative. Median absolute line delta is three lines. The
size-matching control worked, and that check can be marked done.

### Resolved, 02-03 November: the corpus is exonerated

`suppression.py` answered the question the section above left open, and the
answer clears the corpus. **Reach** is how far there was to move, in cohort
standard deviations; **realisation** is how much of the predicted move happened.

| feature | median \|reach\| | median realisation |
|---|---|---|
| `blank_line_ratio` | 0.945 | 0.997 |
| `avg_line_length` | 0.905 | 0.907 |
| `comment_density` | 0.590 | 0.893 |
| `max_block_depth` | 0.694 | **-0.000** |

Predicted against observed displacement, in sd: 0.085 against 0.062 at f=0.10,
0.182 against 0.254 at f=0.25, 0.365 against 0.443 at f=0.50.

The donors differ from the targets by about nine tenths of a standard deviation,
and for three of the four features the splice moves them almost exactly as the
mixing model predicts. **Nothing in the corpus construction is suppressing the
signal, and the size-matching control is not to blame.** The earlier claim that
observed movement was smaller than the bound predicted is retracted: it compared
a whole-file score against a per-feature bound, which are different quantities.

What is wrong is the feature set and the score, in two distinct ways.

**An rms distance is direction-blind.** The score is a magnitude of deviation
from the student's own baseline. At f=0.50 the splice displaces each feature by
about 0.44 sd, in a direction set by where the donor happens to sit relative to
the student, which is arbitrary across pairs. A point already 0.55 to 0.90 sd
from its baseline, displaced 0.44 sd in an arbitrary direction, lands closer
about as often as further away. `layer2_direction.py` confirms it: at f=0.50,
|z| grew in 37 of 73 pairs for `blank_line_ratio`, 38 of 73 for
`avg_line_length`, 37 of 68 for `comment_density`. Coin flips. This is why the
gaps are slightly negative rather than merely small.

**A maximum is not a mixable statistic.** `max_block_depth` has reach 0.694, so
donors do differ on it, yet realisation is exactly -0.000: replacing some
functions cannot lower a maximum unless the deepest is replaced, and a donor's
function only raises it if it is deeper. Tied in 57 of 61 pairs at f=0.10, and
its realisation upper quartile is 2.250, so when it moves it overshoots.

Neither is a tuning problem. A whole-file magnitude cannot detect a partial,
signed substitution. The fix direction is per-unit or windowed features plus a
signed rather than magnitude comparison, which is a design change to Layer 2 and
not a reweighting.

`suppression.py` also reports the **sign** distribution of reach, so the
arbitrary-direction claim can be read off a measurement rather than inferred
from the coin-flip counts above. Run it and record those figures.
