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
the measured features as JSON.

**Cost.** Eleven repositories with full history, because `git blame` on a
shallow clone attributes every line to the boundary commit. 655 MB in October
2026, so budget about 2 GB and do not start below 5 GB free. Blame runs at
roughly 70 ms per file, so attribution takes about two minutes.

### What it found, 07 October 2026

123 files, 15 authors, 7 repositories. All 123 parsed with no errors.

**Java separates authors on every feature.** All ten F ratios are above 1.0,
where Python had six below it. But the ranking is not what it looks like: the
two naming features top the table at F 5.41 and 5.37, and in Python they were
the worst two at 0.17 and 0.18.

**That ranking is contaminated, and the contamination is the main finding.**
Every author in the sample writes in exactly one repository, so "which author"
and "which project" are the same question. Predicting the repository from the
same features scores 2.98x chance. Classifying authors *within* one repository,
which removes the confound, gives:

| repository | authors | the four scored features | the two naming features |
|---|---|---|---|
| metrics | 5 | **2.16x** | 1.62x |
| gson | 2 | **1.64x** | 1.27x |
| jackson-core | 2 | **1.50x** | 1.25x |
| zxing | 3 | **1.30x** | 1.17x |

The naming features' apparent dominance was project vocabulary, not personal
habit. Identifier length and underscore ratio vary enormously between projects
and barely between authors inside one. With the project held constant, the four
features `behavioural.ts` actually scores win in all four repositories.

**So the honest figure is 1.3x to 2.2x, median about 1.6x**, not the 3.76x the
cross-project number suggests. That is the operationally relevant one, because
Layer 2 always compares a student against their own work inside one course,
where conventions are held constant exactly as they are inside one repository.

**The Python size band does not transfer.** 80 to 250 lines was derived on
Python files; the median Java file here is 78 lines, so that band starts above
the middle of the distribution. A Java-appropriate 50 to 150 gives 4.81x
against 3.76x unbanded. `behavioural.ts` is unaffected, because its band is a
ratio of the submission's own line count rather than an absolute range.

**`for_loop_ratio` applies to 26.8% of real Java files**, against 43% in
Python. Writing zero rather than null would fabricate a measurement in nearly
three quarters of them.

### Caveats

The within-repository tests run on 11 to 37 files and 2 to 5 authors, so those
lifts have wide error bars. Resampling the full sample at 80% of authors gives a
median of 19.6% against a point estimate of 26.9%, so the point estimate is
optimistic. This is still library code rather than student code, and
classification is still a proxy for the anomaly detection Layer 2 actually does.

### Still missing

The Python measurement of 02 October has no script. Its method is described in
`docs/PROJECT_NOTES.md` but the code was a scratch file that was deleted, so its
numbers cannot be reproduced and its confound cannot be checked directly. It
almost certainly has the same one.
