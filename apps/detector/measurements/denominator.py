"""
Which denominator separates better: the student's own spread, or the cohort's?

`behavioural.ts` divides by the cohort's spread, floored, while taking the mean
from the student's own anchors. That asymmetry is the central design choice in
Layer 2, and until now the evidence cited for it was an AUC pair of 0.766
against 0.909 which **no script in this folder computes**. It was retracted on
04 November 2026 (File 108). This script exists to replace it with a figure
that can be re-run.

The question posed here is the one Layer 2 actually faces: given a student's
baseline, does a file by somebody else score higher than a file by the student?
That is a ranking question, so the measure is the area under the ROC curve,
computed directly as the Mann-Whitney statistic:

    AUC = P(foreign scores above self) + 0.5 P(tie)

0.5 is chance. Higher is better. Both denominators are scored on exactly the
same files, the same baselines and the same splits, so the comparison is
paired and the difference is attributable to the denominator alone.

Both are floored with the production VARIANCE_FLOOR, because production would
floor whichever denominator it used, and the floor rate is reported separately
since the argument for the cohort denominator is precisely that a spread taken
from three or four anchors is unstable.

    python measurements/denominator.py --work E:\\temp\\pyrepos --skip-clone

The git blame pass takes a few minutes. --draws repeats the whole thing on
different baseline splits, because a single split proved unreliable in this
project before.
"""

import argparse
import os
import random
import statistics
import sys

sys.path.insert(0, os.path.dirname(__file__))

from common import SCORED, attribute, clone_all, measure, select  # noqa: E402

from ablation import VARIANCE_FLOOR, Z_SATURATION  # noqa: E402

# A baseline needs at least this many anchors before Layer 2 will score against
# it at all. Mirrored from minAnchorsForBaseline in the API configuration.
MIN_ANCHORS = 3

# An author needs the anchors plus something held out to score.
MIN_FILES = MIN_ANCHORS + 2


def spread(values):
    """Sample standard deviation, or 0.0 when there is nothing to measure."""
    clean = [v for v in values if isinstance(v, (int, float))]
    if len(clean) < 2:
        return 0.0
    return statistics.stdev(clean)


def score(features, mean, denom):
    """min(1, rms(z) / Z_SATURATION), the way behavioural.ts computes it."""
    zs = []
    floored = 0
    for feature in SCORED:
        value = features.get(feature)
        centre = mean.get(feature)
        if not isinstance(value, (int, float)) or centre is None:
            continue
        raw = denom.get(feature, 0.0)
        std = max(raw, VARIANCE_FLOOR[feature])
        if std > raw:
            floored += 1
        zs.append((float(value) - centre) / std)
    if not zs:
        return None, 0
    rms = (sum(z * z for z in zs) / len(zs)) ** 0.5
    return min(1.0, rms / Z_SATURATION), floored


def auc(self_scores, foreign_scores):
    """
    Mann-Whitney: the chance a foreign file outranks one of the student's own.

    Written out rather than imported because the detector's environment is
    deliberately thin, and because a hand-rolled version can be checked against
    a known case in a unit test.
    """
    if not self_scores or not foreign_scores:
        return None
    wins = 0.0
    for f in foreign_scores:
        for s in self_scores:
            if f > s:
                wins += 1.0
            elif f == s:
                wins += 0.5
    return wins / (len(self_scores) * len(foreign_scores))


def one_draw(by_author, rng):
    """Score every author's held-out files under both denominators."""
    pooled = {"own": {"self": [], "foreign": []}, "cohort": {"self": [], "foreign": []}}
    floor_hits = {"own": 0, "cohort": 0}
    floor_of = {"own": 0, "cohort": 0}
    degenerate = 0

    authors = [a for a, rows in by_author.items() if len(rows) >= MIN_FILES]
    for author in authors:
        rows = list(by_author[author])
        rng.shuffle(rows)
        anchors, held = rows[:MIN_ANCHORS], rows[MIN_ANCHORS:]
        others = [r for a, rs in by_author.items() if a != author for r in rs]
        if not held or not others:
            continue

        mean, own, cohort = {}, {}, {}
        for feature in SCORED:
            vals = [r["features"].get(feature) for r in anchors]
            vals = [v for v in vals if isinstance(v, (int, float))]
            if not vals:
                continue
            mean[feature] = sum(vals) / len(vals)
            own[feature] = spread(vals)
            cohort[feature] = spread(
                [r["features"].get(feature) for r in others]
            )
        if not mean:
            continue

        # The design argument for the cohort denominator is that a spread from
        # three anchors is unstable. Count how often it collapses entirely.
        if any(own.get(f, 0.0) == 0.0 for f in mean):
            degenerate += 1

        sample = others if len(others) <= 120 else rng.sample(others, 120)
        for name, denom in (("own", own), ("cohort", cohort)):
            for row in held:
                got, fl = score(row["features"], mean, denom)
                if got is not None:
                    pooled[name]["self"].append(got)
                    floor_hits[name] += fl
                    floor_of[name] += len(mean)
            for row in sample:
                got, fl = score(row["features"], mean, denom)
                if got is not None:
                    pooled[name]["foreign"].append(got)

    return pooled, floor_hits, floor_of, degenerate, len(authors)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--work", required=True, help="where the clones live")
    ap.add_argument("--skip-clone", action="store_true")
    ap.add_argument("--language", default="python", choices=("python", "java"))
    ap.add_argument("--draws", type=int, default=25)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    if args.language == "python":
        from python_authorship import PYTHON as cfg
    else:
        from java_authorship import JAVA as cfg

    if not args.skip_clone:
        print("CLONING")
        clone_all(cfg, args.work)

    print("ATTRIBUTING (git blame -w per candidate file, a few minutes)")
    rows = attribute(args.work, cfg)
    _single, _counts, kept = select(rows, seed=args.seed)
    print(f"  {len(kept)} files kept")

    print("MEASURING with the detector's own extractor")
    measured, failed = measure(kept, cfg)
    print(f"  parsed {len(measured)} of {len(kept)}, {failed} parse failures")

    by_author = {}
    for row in measured:
        by_author.setdefault(row["author"], []).append(row)
    usable = [a for a, r in by_author.items() if len(r) >= MIN_FILES]
    print(f"  {len(usable)} authors with at least {MIN_FILES} files\n")

    rng = random.Random(args.seed)
    results = {"own": [], "cohort": []}
    floor_rate = {"own": [], "cohort": []}
    degenerate_rate = []

    for draw in range(args.draws):
        if (draw + 1) % 5 == 0:
            print(f"    draw {draw + 1} of {args.draws}", flush=True)
        pooled, hits, of, degenerate, n_authors = one_draw(by_author, rng)
        for name in ("own", "cohort"):
            value = auc(pooled[name]["self"], pooled[name]["foreign"])
            if value is not None:
                results[name].append(value)
            if of[name]:
                floor_rate[name].append(hits[name] / of[name])
        if n_authors:
            degenerate_rate.append(degenerate / n_authors)

    print(f"\n{'=' * 72}")
    print("WHICH DENOMINATOR SEPARATES BETTER")
    print("=" * 72)
    print("AUC of foreign files against the student's own, scored on the same")
    print(f"baselines and the same splits. 0.5 is chance. {args.draws} draws.\n")
    print(f"  {'denominator':14} {'median AUC':>11} {'min':>8} {'max':>8}")
    for name, label in (("own", "own spread"), ("cohort", "cohort spread")):
        got = sorted(results[name])
        if not got:
            print(f"  {label:14} {'no data':>11}")
            continue
        print(f"  {label:14} {got[len(got) // 2]:11.4f} {got[0]:8.4f} {got[-1]:8.4f}")

    pairs = list(zip(results["own"], results["cohort"], strict=True))
    if pairs:
        wins = sum(1 for o, c in pairs if c > o)
        diffs = sorted(c - o for o, c in pairs)
        print(f"\n  cohort beat own on {wins} of {len(pairs)} draws")
        print(f"  median difference, cohort minus own: {diffs[len(diffs) // 2]:+.4f}")

    print(f"\n{'=' * 72}")
    print("WHY THE FLOOR MATTERS, which is the design argument")
    print("=" * 72)
    print("A spread taken from three anchors can collapse to zero, and then every")
    print("z is a real difference divided by an invented constant.\n")
    for name, label in (("own", "own spread"), ("cohort", "cohort spread")):
        got = floor_rate[name]
        if got:
            print(f"  {label:14} hit the variance floor in "
                  f"{statistics.median(got):6.1%} of feature scores")
    if degenerate_rate:
        print(f"\n  authors whose own spread was zero on at least one feature: "
              f"{statistics.median(degenerate_rate):.1%} (median over draws)")


if __name__ == "__main__":
    main()
