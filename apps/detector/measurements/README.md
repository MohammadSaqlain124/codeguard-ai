# Measurements

Scripts that produce the numbers the report quotes. A measurement nobody can
re-derive is an anecdote, not evidence, so anything cited belongs in here.

## java_authorship.py

Asks whether Layer 2's style features separate authors in Java, replicating the
Python measurement of 02 October so the two are comparable: same 85% ownership
threshold, same 30 to 700 line bounds, same cap of twelve files per author, same
leave-one-out nearest-centroid classifier on z-scored features.

Features come from `app.features.extract_features` directly rather than a
replica, so there is nothing that can drift from the running service.

```
cd apps/detector
python measurements/java_authorship.py --work /tmp/javarepos
```

`--skip-clone` reuses a work directory you already have. `--save FILE` writes
the measured features as JSON. `--seed N` chooses which sample of files the
per-author cap keeps. `--draws N` re-runs everything on N samples and reports
how much each figure moves; it defaults to 25 and is the part worth reading.

**Cost.** Eleven repositories with full history, because `git blame` on a
shallow clone attributes every line to the boundary commit. 655 MB in October
2026, so budget about 2 GB and do not start below 5 GB free. Blame runs at
roughly 70 ms per file, so attribution takes about two minutes. The 25 draws add
about a minute, because every file is parsed once and cached across draws.

### Why `--draws` exists

Some authors have 230 eligible files and the cap keeps twelve. Which twelve is
therefore a *sample*, and a figure that moves a lot from one sample to the next
is not a result. The first version of this script took the alphabetically first
twelve, which was wrong twice over: it depended on the path separator, so Linux
and Windows disagreed, and alphabetically adjacent files sit in the same package
and resemble each other more than an author's work does in general.

Three claims in the first write-up of these findings did not survive the fix.
They are listed under "Retracted" below, because a measurement that quietly
changes its answer is worse than one that says what it got wrong.

### What it found, 07 October 2026

The funnel is sample-independent and reproduced exactly on Linux and Windows:

```
candidates (30-700 lines, no tests)   1397
one author owns >= 85% of lines        687
distinct authors after alias merge      57
authors with >= 4 files                 15
files measured (cap 12 per author)     123
```

All 123 parsed with no errors, which is the single most reassuring number here:
the tree-sitter Java grammar handled real library code without exception.

**The headline, over 25 draws.** Median, with the range across samples:

| quantity | median | range | verdict |
|---|---|---|---|
| author, all applicable features | **3.65x** | 2.94x to 4.94x | holds |
| author, the four scored features | 2.68x | 1.59x to 3.29x | holds |
| **predicting the repository** | **3.23x** | 2.58x to 3.82x | holds |
| within metrics, scored four | **2.03x** | 1.62x to 2.43x | holds |
| within gson, scored four | 1.64x | no spread | holds |
| within zxing, scored four | 1.17x | 0.78x to 1.96x | **chance** |
| within jackson-core, scored four | 1.12x | 0.88x to 1.38x | **chance** |

**The confound is the main finding, and it is robust.** Every author in a sample
like this writes in exactly one repository, so "which author" and "which
project" are the same question. Predicting the *repository* from the same
features scores 3.23x chance, never below 2.58x in 25 draws. A large part of the
3.65x author figure is the model recognising the project.

**Within one repository the honest answer is narrower than it first looked.**
Only the two largest samples support a claim: metrics at 2.03x, never below
1.62x across 25 draws, and gson at a flat 1.64x. zxing and jackson-core both
straddle 1.0 depending on which files the cap keeps, so neither is
distinguishable from chance and neither belongs in the report as a number.

So the defensible sentence is: **with the project held constant, the scored
features separate authors at about 1.6x to 2.0x in the samples large enough to
measure, and are indistinguishable from chance in the samples that are not.**
That is the operationally relevant figure, because Layer 2 always compares a
student against their own work inside one course, where conventions are held
constant exactly as they are inside one repository.

**Six of the ten features clear F = 1.0 in every draw**, where the Python run had
six *below* 1.0. Ranked by median F:

| feature | median F | above 1.0 | in the top four |
|---|---|---|---|
| underscore_identifier_ratio | 7.31 | 25/25 | 24/25 |
| avg_line_length | 4.12 | 25/25 | 19/25 |
| avg_identifier_length | 3.79 | 25/25 | 21/25 |
| comment_density | 3.47 | 25/25 | 17/25 |
| blank_line_ratio | 3.23 | 25/25 | 9/25 |
| functions_per_100_lines | 3.10 | 25/25 | 9/25 |
| avg_params_per_function | 1.44 | 24/25 | 0/25 |
| max_block_depth | 1.32 | 21/25 | 0/25 |
| avg_function_lines | 1.27 | 18/25 | 0/25 |
| for_loop_ratio | 0.87 | 10/25 | 1/25 |

The two naming features make the top four in 20 of 25 draws, and in Python they
were the worst two at F 0.17 and 0.18. That reversal is what prompted the
confound check, and the confound explains it: identifier length and underscore
ratio vary enormously between projects and barely between authors inside one.

**One caution for Layer 2 as built.** `max_block_depth`, one of the four features
`behavioural.ts` scores, clears 1.0 in only 21 of 25 draws on Java. It was
chosen on Python data where it ranked third. It is not disqualified, but it is
the weakest of the four here and worth re-checking if Java ever becomes a
primary language for the system.

**`for_loop_ratio` applies to 27.6% of real Java files**, against 43% in Python.
Writing zero rather than null would fabricate a measurement in nearly three
quarters of them. Its F ratio is also the least stable of the ten, ranging 0.28
to 3.08, which is what a feature measured on a quarter of the sample looks like.

### Retracted

Three claims from the first write-up of this measurement, all of which came from
the single alphabetical sample and none of which survived the 25 draws:

1. **"All ten F ratios are above 1.0."** Six are, in every draw. Four are not
   reliable, and `for_loop_ratio` clears 1.0 in fewer than half the draws.
2. **"Within one repository, 1.30x to 2.16x, median about 1.6x."** The 1.30x
   (zxing) and 1.50x (jackson-core) figures were one lucky sample each; both
   straddle chance. Only metrics and gson support a number.
3. **"A Java-appropriate 50 to 150 line band gives 4.81x against 3.76x
   unbanded."** No band beats the unbanded figure once the sample is accounted
   for. Band 40-120 medians 3.67x against 3.65x unbanded, which is noise, and
   band 80-250 swings from 0.88x to 4.05x. Size banding did not transfer to Java
   in either direction: it neither helps nor hurts reliably.

The classification figures that did *not* change between Linux and Windows were
the funnel and the all-features lift. Everything quoted to three significant
figures in the first write-up moved.

### Caveats

The within-repository tests run on 11 to 37 files and 2 to 5 authors, which is
why two of the four straddle chance. This is library code rather than student
code, written by professionals over years, and classification is a proxy for the
anomaly detection Layer 2 actually does. The 25 draws measure sensitivity to the
per-author cap only; they do not address the choice of repositories, the 85%
ownership threshold, or the line bounds, any of which could matter as much.

### Still missing

The Python measurement of 02 October has no script. Its method is described in
`docs/PROJECT_NOTES.md` but the code was a scratch file that was deleted, so its
numbers cannot be reproduced and its confound cannot be checked directly. Its
2.27x and 3.15x almost certainly carry the same confound, and on the evidence
here they also carry an unreported sampling range.
