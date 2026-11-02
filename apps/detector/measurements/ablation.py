"""
Does Layer 2 add signal beyond Layer 1?

This is the study slide 23 calls the one that proves the thesis, and it has
never been run because until the style-shift corpus existed there was no
labelled outsourced work to run it on.

The claim under test, from slide 7: a per-student longitudinal baseline gives a
signal orthogonal to similarity matching, and it is the one that stays
informative when the submitted code is original. Slide 4 states the threat it
is meant to catch: a freelancer or a model writes part of the work, so there is
no matching copy anywhere in the cohort.

**Two conditions, and the difference between them is the whole experiment.**

  donor-excluded   The file the spliced section came from is not in Layer 1's
                   comparison pool. This is the real threat model, and the only
                   condition that tests the claim. Layer 1 should be near
                   chance here; if Layer 2 still separates spliced from clean,
                   the thesis is measured rather than asserted.

  donor-included   The donor file is in the pool, so the spliced section is a
                   verbatim copy of something Layer 1 can see. A positive
                   control: if Layer 1 misses it here, the pipeline is broken
                   and nothing from the other condition can be trusted.

**Two analyses, for two different questions.**

  cohort     One version of each pair, chosen at random, so a cohort never
             contains both versions of one file. Ranked, then precision@k.
             Repeated over draws, because a single draw is a sample and this
             project has been bitten by quoting one before.

  paired     Both versions of every pair, spliced score against clean score.
             Here the duplication is the point rather than a leak. A sign test
             on the differences, which needs no distributional assumption.

**What this measures, and what it does not.** Features come from
app.features.extract_features, the same call the running service makes, so
those cannot drift. The scoring does not: Layer 2's z-scoring lives in
TypeScript in services/behavioural.ts, and the constants below are mirrored
from it by hand. If that file changes and this one does not, these numbers
quietly stop describing the system. That is a real limitation and it belongs
in anything written from this script.
"""

import argparse
import json
import os
import random
import sys
from collections import defaultdict
from math import comb, sqrt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.features import extract_features  # noqa: E402
from app.normalise import normalise  # noqa: E402
from app.normalise import size as tree_size  # noqa: E402
from app.parsing import parse_source  # noqa: E402
from app.prefilter import label_counts, rank  # noqa: E402
from app.units import compare_unit_sets, extract_units  # noqa: E402

# Mirrored from services/behavioural.ts. See the note above about drift.
SCORED_FEATURES = ("blank_line_ratio", "avg_line_length", "max_block_depth", "comment_density")
VARIANCE_FLOOR = {
    "blank_line_ratio": 0.0065,
    "avg_line_length": 0.4947,
    "max_block_depth": 0.2236,
    "comment_density": 0.001,
}
Z_SATURATION = 3

# DEFAULT_DETECTION_CONFIG in the API. Layer 3 is absent, so activeWeight is
# w1 + w2 rather than 1, exactly as detection.ts renormalises it.
W1, W2 = 0.4, 0.3

AT_K = (10, 20, 50)

# Mirrored from app/main.py. The detector does not run the expensive
# comparison against every candidate it is handed: it ranks them by label-bag
# overlap and gives only this many the real treatment. MAX_CANDIDATES is the
# most candidates the endpoint will accept at all.
MAX_DEEP_CANDIDATES = 10
MAX_CANDIDATES = 50


def load_source(path):
    try:
        return open(path, "rb").read().decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None


class Files:
    """Parses each file once and hands out features and prepared units."""

    def __init__(self, language):
        self.language = language
        self._features = {}
        self._units = {}
        self._size = {}
        self._labels = {}
        self.failed = set()

    def _parse(self, path):
        if path in self._features or path in self.failed:
            return
        source = load_source(path)
        if source is None:
            self.failed.add(path)
            return
        result = parse_source(self.language, source)
        if not result.ok or result.root is None:
            self.failed.add(path)
            return
        # Two different trees. extract_features reads the raw tree-sitter nodes,
        # because style lives in the things normalisation throws away. Units and
        # size need the normalised tree, whose nodes carry labels instead of
        # tree-sitter types, which is what makes renaming invisible to Layer 1.
        tree = normalise(result.root)
        if tree is None:
            self.failed.add(path)
            return
        self._features[path] = extract_features(result.root, source.encode("utf-8"))
        self._units[path] = extract_units(tree, self.language)
        self._size[path] = tree_size(tree)
        self._labels[path] = label_counts(tree)

    def features(self, path):
        self._parse(path)
        return self._features.get(path)

    def units(self, path):
        self._parse(path)
        return self._units.get(path), self._size.get(path, 0)

    def labels(self, path):
        self._parse(path)
        return self._labels.get(path)


def baseline_for(paths, files):
    """
    This student's usual value for each scored feature.

    behavioural.ts weights each anchor by its trust, which depends on whether
    the work was invigilated or merely nominated. Every file here is an
    ordinary file from the author's own history, so they all carry the same
    weight and the weighting collapses to a plain mean. Worth saying out loud:
    this measurement cannot say anything about how trust weighting behaves.
    """
    sums = defaultdict(list)
    for path in paths:
        values = files.features(path)
        if values is None:
            continue
        for feature in SCORED_FEATURES:
            value = values.get(feature)
            if isinstance(value, (int, float)):
                sums[feature].append(float(value))
    return {f: sum(v) / len(v) for f, v in sums.items() if v}


def cohort_spread(by_author, files, exclude):
    """
    How much students differ from one another, per feature, with the student
    under test left out.

    Leaving them in would put their own deviation into the reference it is
    measured against, which is the same reason the running system excludes a
    student from their own cohort statistics.
    """
    spread = {}
    for feature in SCORED_FEATURES:
        values = []
        for author, paths in by_author.items():
            if author == exclude:
                continue
            for path in paths:
                got = files.features(path)
                if got is None:
                    continue
                value = got.get(feature)
                if isinstance(value, (int, float)):
                    values.append(float(value))
        if len(values) < 2:
            spread[feature] = 0.0
            continue
        mean = sum(values) / len(values)
        var = sum((v - mean) ** 2 for v in values) / len(values)
        spread[feature] = sqrt(var)
    return spread


def layer2_score(path, baseline, spread, files):
    """min(1, rms(z) / Z_SATURATION), the way behavioural.ts computes it."""
    values = files.features(path)
    if values is None:
        return None
    zs = []
    for feature in SCORED_FEATURES:
        value = values.get(feature)
        mean = baseline.get(feature)
        if not isinstance(value, (int, float)) or mean is None:
            continue
        std = max(spread.get(feature, 0.0), VARIANCE_FLOOR[feature])
        zs.append((float(value) - mean) / std)
    if not zs:
        return None
    rms = sqrt(sum(z * z for z in zs) / len(zs))
    return min(1.0, rms / Z_SATURATION)


def layer1_score(path, pool, files, cache):
    """
    Highest similarity over the candidates the detector would actually compare.

    An earlier version compared against every file in the pool. That measures a
    system nobody deployed: app/main.py shortlists candidates by label-bag
    overlap and runs the tree comparison on only the top MAX_DEEP_CANDIDATES,
    so a real match sitting outside the shortlist is one the API never finds.
    Comparing exhaustively here would have credited Layer 1 with detections the
    deployed system cannot make, which biases the ablation against Layer 2 by
    making Layer 1 look stronger than it is. It was also what made this script
    take hours: the shortlist caps the expensive work at ten comparisons per
    file however large the pool is.

    The donor gets no special treatment in the donor-included condition. If the
    cheap filter does not shortlist it, the API would not have compared it
    either, and the control is meant to ask whether the real system catches a
    verbatim copy, not whether an idealised one would.
    """
    units_a, size_a = files.units(path)
    labels_a = files.labels(path)
    if not units_a or labels_a is None:
        return 0.0
    usable = [p for p in pool if files.units(p)[0] and files.labels(p) is not None]
    if not usable:
        return 0.0

    best = 0.0
    for index in rank(labels_a, [files.labels(p) for p in usable], MAX_DEEP_CANDIDATES):
        other = usable[index]
        # Both conditions draw the same pools from the same seed, so without
        # this the second condition recomputes the first one's comparisons.
        key = (path, other)
        if key not in cache:
            units_b, size_b = files.units(other)
            cache[key] = compare_unit_sets(units_a, units_b, size_a, size_b).similarity
        if cache[key] > best:
            best = cache[key]
    return best


def rps(l1, l2):
    """Renormalised over the layers that ran. Layer 3 is absent, so 0.7."""
    return (W1 * l1 + W2 * l2) / (W1 + W2)


def precision_at_k(ranked, k):
    """Share of the top k that are genuinely spliced."""
    top = ranked[:k]
    if not top:
        return 0.0
    return sum(1 for item in top if item["label"] == "spliced") / len(top)


def sign_test(diffs):
    """
    Two-sided exact binomial on the signs, ignoring ties.

    A sign test rather than a t-test because nothing here is known to be
    normal, and rather than Wilcoxon because this needs no extra dependency
    and the detector's environment is deliberately thin.
    """
    wins = sum(1 for d in diffs if d > 0)
    losses = sum(1 for d in diffs if d < 0)
    n = wins + losses
    if n == 0:
        return wins, losses, 1.0
    tail = sum(comb(n, i) for i in range(min(wins, losses) + 1))
    p = min(1.0, 2 * tail / (2 ** n))
    return wins, losses, p


def run_condition(items, files, donor_in_pool, seed, pool_size, cache):
    rng = random.Random(seed)
    scored = []
    # The spread only varies by which author is excluded, so it is worked out
    # once per author rather than once per file.
    spread_cache = {}

    clean_by_author = defaultdict(list)
    for item in items:
        if item["label"] == "clean":
            clean_by_author[item["author"]].append(item["path"])

    for n, item in enumerate(items, 1):
        if n % 50 == 0:
            print(f"    scored {n} of {len(items)}", flush=True)

        author = item["author"]
        baseline = baseline_for(item["baseline_paths"], files)
        if author not in spread_cache:
            spread_cache[author] = cohort_spread(clean_by_author, files, exclude=author)
        spread = spread_cache[author]
        l2 = layer2_score(item["path"], baseline, spread, files)
        if l2 is None:
            continue

        # The pool is other students' work, which is what a cohort is. The
        # donor's own file is the one thing that decides the condition.
        candidates = [p for a, ps in clean_by_author.items() if a != author for p in ps]
        rng.shuffle(candidates)
        pool = candidates[:pool_size]
        if donor_in_pool and item.get("donor_source"):
            pool = pool + [item["donor_source"]]

        l1 = layer1_score(item["path"], pool, files, cache)
        scored.append({**item, "l1": l1, "l2": l2, "rps": rps(l1, l2), "pool": len(pool)})

    return scored


def cohort_analysis(scored, draws, seed):
    """One version of each pair per draw, so no file appears twice."""
    by_pair = defaultdict(list)
    for s in scored:
        by_pair[s["pair_id"]].append(s)
    usable = [v for v in by_pair.values() if len(v) == 2]

    out = {key: {k: [] for k in AT_K} for key in ("l1", "rps", "l2")}
    rng = random.Random(seed)
    for _ in range(draws):
        sample = [rng.choice(v) for v in usable]
        for key in out:
            ranked = sorted(sample, key=lambda s: s[key], reverse=True)
            for k in AT_K:
                out[key][k].append(precision_at_k(ranked, k))
    return out, len(usable)


def median(values):
    s = sorted(values)
    return s[len(s) // 2] if s else 0.0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpus", required=True, help="the --out directory style_shift.py wrote")
    ap.add_argument("--language", default="python", choices=("python", "java"))
    ap.add_argument("--draws", type=int, default=25)
    ap.add_argument(
        "--pool",
        type=int,
        default=MAX_CANDIDATES,
        help=f"cohort candidates offered to Layer 1, capped at {MAX_CANDIDATES} "
        "because that is the most the detector endpoint accepts",
    )
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--save", help="write the per-item scores as json")
    args = ap.parse_args()

    manifest_path = os.path.join(args.corpus, f"manifest-{args.language}.json")
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    items = manifest["items"]
    print(f"{len(items)} corpus files from {manifest_path}")

    # The positive control puts the donor's own file in Layer 1's pool, so it
    # needs the file the spliced text actually came from. An earlier version of
    # this script stood in the donor author's first clean file, which is a
    # different experiment: Layer 1 would have been asked to match an unrelated
    # file, scored near chance, and the control would have read as "Layer 1
    # misses verbatim copying". A corpus that does not record the donor file
    # does not get this condition at all.
    spliced = [item for item in items if item["label"] == "spliced"]
    known = [item for item in spliced if item.get("donor_path")]
    for item in items:
        item["donor_source"] = item.get("donor_path")

    conditions = [("donor-excluded", False)]
    if spliced and len(known) == len(spliced):
        conditions.append(("donor-included", True))
    else:
        print(
            f"\nthe donor-included control is skipped: {len(known)} of "
            f"{len(spliced)} spliced files record donor_path. Regenerate the "
            "corpus with style_shift.py, which now writes it."
        )

    if args.pool > MAX_CANDIDATES:
        raise SystemExit(
            f"--pool {args.pool} exceeds MAX_CANDIDATES={MAX_CANDIDATES}, the most "
            "the detector accepts. A larger pool measures a system that cannot run."
        )

    files = Files(args.language)
    # Shared across both conditions on purpose: they draw identical pools from
    # the same seed, so a comparison computed once is correct for both.
    cache = {}

    results = {}
    for name, donor_in_pool in conditions:
        print(f"\ncondition: {name}")
        scored = run_condition(items, files, donor_in_pool, args.seed, args.pool, cache)

        # Stratified by splice fraction, because the corpus reuses one source
        # file across the fractions: 214 pairs come from 94 distinct files, so
        # pooling them feeds the sign test up to three copies of the same clean
        # file and an n it has not earned. Within one fraction each source file
        # appears at most once, so the strata are independent. Costs nothing
        # extra, since the scoring already happened.
        strata = {}
        for frac in sorted({s["requested_fraction"] for s in scored}):
            subset = [s for s in scored if s["requested_fraction"] == frac]
            cohort, pairs = cohort_analysis(subset, args.draws, args.seed)
            strata[frac] = {"scored": subset, "cohort": cohort, "pairs": pairs}
        results[name] = {"scored": scored, "strata": strata}

    report(results, args.draws, files)

    if args.save:
        with open(args.save, "w", encoding="utf-8") as handle:
            json.dump(
                {
                    "draws": args.draws,
                    "pool": args.pool,
                    "seed": args.seed,
                    "conditions": {
                        name: [
                            {k: v for k, v in s.items() if k != "baseline_paths"}
                            for s in r["scored"]
                        ]
                        for name, r in results.items()
                    },
                },
                handle,
                indent=2,
            )
        print(f"\nper-item scores written to {args.save}")


def report(results, draws, files):
    print("\n" + "=" * 72)
    print("ABLATION — does Layer 2 add signal beyond Layer 1?")
    print("=" * 72)
    if files.failed:
        print(f"\n{len(files.failed)} file(s) could not be parsed and were skipped")

    for name, r in results.items():
        sources = len({s["source_path"] for s in r["scored"]})
        print(f"\n{'=' * 72}\n{name}: {len(r['scored'])} files scored, "
              f"{sources} distinct source files\n{'=' * 72}")
        for frac, stratum in r["strata"].items():
            stratum_report(frac, stratum, draws)


def stratum_report(frac, stratum, draws):
    r = stratum
    scored = r["scored"]
    spliced = [s for s in scored if s["label"] == "spliced"]
    clean = [s for s in scored if s["label"] == "clean"]
    print(f"\n--- splice fraction {frac}  ({r['pairs']} pairs, {len(scored)} files)")

    # The requested fraction is a design label, not what the splice achieved:
    # units are coarse, so a bucket asking for half a file settles near 0.44 and
    # the buckets overlap each other. measurements/README.md says to bucket on
    # the actual fraction for exactly this reason. Printing the range keeps the
    # overlap visible, and measurements/independence.py tests the dose-response
    # continuously against actual_fraction, where no bucket edge can decide it.
    actual = sorted(s["actual_fraction"] for s in spliced)
    if actual:
        print(f"    actual fraction: median {actual[len(actual) // 2]:.3f}, "
              f"range {actual[0]:.3f} to {actual[-1]:.3f}")

    print("\n  mean score by class")
    print(f"    {'':12} {'clean':>8} {'spliced':>9} {'gap':>8}")
    for key, label in (("l1", "Layer 1"), ("l2", "Layer 2"), ("rps", "RPS")):
        c = sum(s[key] for s in clean) / len(clean) if clean else 0
        p = sum(s[key] for s in spliced) / len(spliced) if spliced else 0
        print(f"    {label:12} {c:8.4f} {p:9.4f} {p - c:+8.4f}")

    print(f"\n  precision@k, median over {draws} draws")
    print(f"    {'':12}" + "".join(f"{'@' + str(k):>10}" for k in AT_K))
    for key, label in (("l1", "Layer 1 only"), ("rps", "L1 + L2"), ("l2", "Layer 2 only")):
        row = "".join(f"{median(r['cohort'][key][k]):10.3f}" for k in AT_K)
        print(f"    {label:12}{row}")

    # Chance is 0.5 by construction, not something to measure: every draw
    # takes exactly one of the two versions of each usable pair, so a random
    # ranking puts a spliced file in the top k half the time whatever the
    # corpus looks like. An earlier version divided spliced files by all
    # scored files. That is a different quantity, and orphaned halves, where
    # one version of a pair failed to parse, pulled it below 0.5 and made a
    # non-result look like a lift.
    base = 0.5
    print(f"    {'chance':12}" + "".join(f"{base:10.3f}" for _ in AT_K))

    print("\n  paired, spliced minus clean on the same file")
    by_pair = defaultdict(dict)
    for s in scored:
        by_pair[s["pair_id"]][s["label"]] = s
    for key, label in (("l1", "Layer 1"), ("l2", "Layer 2"), ("rps", "RPS")):
        diffs = [
            v["spliced"][key] - v["clean"][key]
            for v in by_pair.values()
            if "spliced" in v and "clean" in v
        ]
        wins, losses, p = sign_test(diffs)
        # The direction matters more than the p-value here. A two-sided test
        # fires on any departure from an even split, and Layer 2's split has
        # been far from even in the direction of spliced scoring LOWER. A bare
        # "significant" on that line reads as support for the hypothesis when
        # it is evidence against it.
        if p >= 0.05:
            verdict = "not significant"
        elif wins > losses:
            verdict = "significant, spliced higher"
        else:
            verdict = "significant, spliced LOWER, against the hypothesis"
        print(f"    {label:9} higher on spliced in {wins} of {wins + losses}"
              f"   p = {p:.2e}   {verdict}")


if __name__ == "__main__":
    main()
