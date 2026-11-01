"""
Why does Layer 2 score lower on spliced files than on clean ones?

The ablation found that splicing another author's code into a file makes
Layer 2's score go down. Behavioural fingerprinting predicts the opposite: a
file that is partly somebody else's should sit further from the student's usual
numbers, not closer. That is either a real null result or a bug in how the
score is built, and a thesis should not report the first until it has ruled out
the second.

So this takes the four scored features one at a time and asks, for each pair,
whether the student's deviation grew or shrank when the splice went in. Three
outcomes tell three different stories:

  features barely move        the splice is too small to shift a whole-file
                              ratio, and the method needs a different unit of
                              measurement, not a different weight
  features move, |z| grows    the score is wrong somewhere between the z and
                              the published number
  features move, |z| shrinks  splicing genuinely makes a file look more
                              typical, which would be a real and publishable
                              finding, and a surprising one

Layer 1 is not involved, so this runs in about a minute instead of forty.

    python measurements/layer2_direction.py --corpus E:\\temp\\splices
"""

import argparse
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ablation import (  # noqa: E402
    SCORED_FEATURES,
    VARIANCE_FLOOR,
    Z_SATURATION,
    Files,
    baseline_for,
    cohort_spread,
    sign_test,
)


def zs_for(path, baseline, spread, files):
    """The per-feature z scores behind one Layer 2 number."""
    values = files.features(path)
    if values is None:
        return None
    out = {}
    for feature in SCORED_FEATURES:
        value = values.get(feature)
        mean = baseline.get(feature)
        if not isinstance(value, (int, float)) or mean is None:
            continue
        std = max(spread.get(feature, 0.0), VARIANCE_FLOOR[feature])
        out[feature] = (float(value) - mean) / std
    return out or None


def mean(values):
    return sum(values) / len(values) if values else 0.0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--language", default="python", choices=("python", "java"))
    args = ap.parse_args()

    path = os.path.join(args.corpus, f"manifest-{args.language}.json")
    with open(path, encoding="utf-8") as handle:
        items = json.load(handle)["items"]
    print(f"{len(items)} corpus files from {path}")

    files = Files(args.language)
    clean_by_author = defaultdict(list)
    for item in items:
        if item["label"] == "clean":
            clean_by_author[item["author"]].append(item["path"])

    # One entry per pair: the clean and spliced z vectors side by side.
    pairs = defaultdict(dict)
    spreads = {}
    for n, item in enumerate(items, 1):
        if n % 100 == 0:
            print(f"    {n} of {len(items)}", flush=True)
        author = item["author"]
        if author not in spreads:
            spreads[author] = cohort_spread(clean_by_author, files, exclude=author)
        baseline = baseline_for(item["baseline_paths"], files)
        z = zs_for(item["path"], baseline, spreads[author], files)
        if z is None:
            continue
        raw = files.features(item["path"])
        pairs[item["pair_id"]][item["label"]] = (z, raw, item["requested_fraction"])

    usable = [v for v in pairs.values() if "clean" in v and "spliced" in v]
    print(f"\n{len(usable)} pairs with both versions scored")

    fractions = sorted({v["clean"][2] for v in usable})
    for frac in fractions:
        group = [v for v in usable if v["clean"][2] == frac]
        print(f"\n{'=' * 78}\nsplice fraction {frac}   ({len(group)} pairs)\n{'=' * 78}")
        print(f"\n{'feature':20} {'raw clean':>10} {'raw splice':>11} "
              f"{'|z| clean':>10} {'|z| splice':>11} {'grew':>9} {'p':>9}")
        for feature in SCORED_FEATURES:
            rc, rs, zc, zs, grew = [], [], [], [], []
            for v in group:
                zcl, rawc, _ = v["clean"]
                zsp, raws, _ = v["spliced"]
                if feature not in zcl or feature not in zsp:
                    continue
                rc.append(rawc[feature])
                rs.append(raws[feature])
                zc.append(abs(zcl[feature]))
                zs.append(abs(zsp[feature]))
                grew.append(abs(zsp[feature]) - abs(zcl[feature]))
            if not grew:
                continue
            wins, losses, p = sign_test(grew)
            print(f"{feature:20} {mean(rc):10.4f} {mean(rs):11.4f} "
                  f"{mean(zc):10.4f} {mean(zs):11.4f} "
                  f"{wins:4}/{wins + losses:<4} {p:9.2e}")

        # The published score is min(1, rms/Z_SATURATION), so a feature can
        # move without the score moving once the saturation clamp is reached.
        clamped_c = sum(
            1 for v in group
            if rms(v["clean"][0]) >= Z_SATURATION
        )
        clamped_s = sum(
            1 for v in group
            if rms(v["spliced"][0]) >= Z_SATURATION
        )
        print(f"\n  pairs whose score is clamped at 1.0 by Z_SATURATION={Z_SATURATION}: "
              f"{clamped_c} clean, {clamped_s} spliced")


def rms(z):
    if not z:
        return 0.0
    return (sum(v * v for v in z.values()) / len(z)) ** 0.5


if __name__ == "__main__":
    main()
