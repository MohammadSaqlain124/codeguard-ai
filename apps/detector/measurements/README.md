# Measurements

Scripts that produce the numbers the report quotes. A measurement nobody can
re-derive is an anecdote, not evidence, so anything cited belongs in here.

```
common.py              everything both measurements share
java_authorship.py     the Java repository list and file filters
python_authorship.py   the Python repository list and file filters
```

The two language scripts are configuration only. All the selection,
attribution, statistics and reporting live in `common.py`, so "the same method
applied to both languages" is literally the same code rather than two
descriptions that can drift apart. Features come from
`app.features.extract_features` directly rather than a replica, so nothing can
disagree with the running service. `app/features.py` is already
language-agnostic: it unions every language's node labels instead of branching,
which is why one extractor serves both.

```
cd apps/detector
python measurements/java_authorship.py   --work /tmp/javarepos
python measurements/python_authorship.py --work /tmp/pyrepos
```

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
