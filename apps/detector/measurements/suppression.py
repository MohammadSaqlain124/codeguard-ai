"""
Why is Layer 2's feature movement smaller than mixing predicts?

The direction diagnostic established that the four scored features barely move
when another author's code is spliced in, even at half the file. A simple
mixing model says they should: a file that is fraction f somebody else's ought
to land at (1-f) times the student's typical value plus f times the donor's.
Observed movement is far below that. Two very different things could cause it,
and they lead to opposite conclusions.

  the donors are not different    authors in this cohort have nearly the same
                                  whole-file ratios, so there is nothing to
                                  move toward. Then no aggregation level
                                  rescues these features and the feature set
                                  itself is the problem.

  the splice does not move them   authors do differ, but the spliced file keeps
                                  the target's value anyway. Then the corpus
                                  construction is suppressing the signal and
                                  the null result is partly an artifact, which
                                  would have to be said very plainly.

So this measures both quantities per pair:

  reach        |donor - clean| for each feature, in units of cohort spread.
               How far there is to move. Near zero means the donors are not
               different and the feature cannot work by construction.

  realisation  (spliced - clean) / (f * (donor - clean)). How much of the
               predicted move actually happened. Near 1 means mixing works as
               modelled. Near 0 means the splice preserved the target's value.

Feature extraction only, so this costs about a minute, not forty.

    python measurements/suppression.py --corpus E:\\temp\\splices
"""

import argparse
import json
import os
import statistics
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ablation import (  # noqa: E402
    SCORED_FEATURES,
    VARIANCE_FLOOR,
    Files,
    cohort_spread,
)

# Below this, the predicted move is too small to divide by: the ratio becomes
# noise over noise. Expressed in units of cohort spread, not raw units, so it
# means the same thing for a line count and for a ratio.
MIN_PREDICTED_MOVE = 0.05


def median(values):
    return statistics.median(values) if values else float("nan")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--language", default="python", choices=("python", "java"))
    args = ap.parse_args()

    path = os.path.join(args.corpus, f"manifest-{args.language}.json")
    with open(path, encoding="utf-8") as handle:
        items = json.load(handle)["items"]
    print(f"{len(items)} corpus files from {path}")

    spliced = [i for i in items if i["label"] == "spliced" and i.get("donor_path")]
    if not spliced:
        raise SystemExit(
            "no spliced item records donor_path. Regenerate the corpus with "
            "style_shift.py, which writes it."
        )

    files = Files(args.language)
    clean_by_author = defaultdict(list)
    clean_by_pair = {}
    for item in items:
        if item["label"] == "clean":
            clean_by_author[item["author"]].append(item["path"])
            clean_by_pair[item["pair_id"]] = item["path"]

    spreads = {}
    rows = []
    for n, item in enumerate(spliced, 1):
        if n % 50 == 0:
            print(f"    {n} of {len(spliced)}", flush=True)

        author = item["author"]
        if author not in spreads:
            spreads[author] = cohort_spread(clean_by_author, files, exclude=author)
        spread = spreads[author]

        clean_path = clean_by_pair.get(item["pair_id"])
        if clean_path is None:
            continue
        c = files.features(clean_path)
        s = files.features(item["path"])
        donor = files.features(item["donor_path"])
        if c is None or s is None or donor is None:
            continue

        f = item["actual_fraction"]
        if f <= 0:
            continue
        for feature in SCORED_FEATURES:
            cv, sv, dv = c.get(feature), s.get(feature), donor.get(feature)
            if not all(isinstance(v, (int, float)) for v in (cv, sv, dv)):
                continue
            std = max(spread.get(feature, 0.0), VARIANCE_FLOOR[feature])
            reach = (dv - cv) / std
            predicted = f * reach
            observed = (sv - cv) / std
            rows.append(
                {
                    "feature": feature,
                    "requested": item["requested_fraction"],
                    "f": f,
                    "reach": reach,
                    "predicted": predicted,
                    "observed": observed,
                }
            )

    if not rows:
        raise SystemExit("nothing measurable: no pair had all three files readable")

    print(f"\n{len(rows)} feature observations over {len(spliced)} spliced files")
    if files.failed:
        print(f"{len(files.failed)} file(s) unreadable or unparsable, skipped")

    print(f"\n{'=' * 78}")
    print("REACH - how far there is to move, in cohort standard deviations")
    print("=" * 78)
    print("A feature whose donors sit on top of the target cannot detect a splice")
    print("however the splice is built. |reach| near zero is a dead feature.\n")
    print(f"{'feature':20} {'median |reach|':>15} {'p25':>8} {'p75':>8} {'n':>6}")
    for feature in SCORED_FEATURES:
        vals = sorted(abs(r["reach"]) for r in rows if r["feature"] == feature)
        if not vals:
            continue
        print(f"{feature:20} {median(vals):15.3f} "
              f"{vals[len(vals) // 4]:8.3f} {vals[3 * len(vals) // 4]:8.3f} {len(vals):6}")

    print(f"\n{'=' * 78}")
    print("REALISATION - how much of the predicted move actually happened")
    print("=" * 78)
    print("1.0 means mixing behaves as modelled and the feature set is the problem.")
    print("Near 0 means the splice kept the target's value and the corpus is.")
    print(f"Pairs whose predicted move is under {MIN_PREDICTED_MOVE} sd are excluded:")
    print("dividing by a move that small measures noise over noise.\n")
    print(f"{'feature':20} {'median':>9} {'p25':>8} {'p75':>8} {'usable':>8} {'dropped':>8}")
    for feature in SCORED_FEATURES:
        got = [r for r in rows if r["feature"] == feature]
        usable = [r for r in got if abs(r["predicted"]) >= MIN_PREDICTED_MOVE]
        vals = sorted(r["observed"] / r["predicted"] for r in usable)
        if not vals:
            print(f"{feature:20} {'-':>9} {'-':>8} {'-':>8} {0:8} {len(got):8}")
            continue
        print(f"{feature:20} {median(vals):9.3f} "
              f"{vals[len(vals) // 4]:8.3f} {vals[3 * len(vals) // 4]:8.3f} "
              f"{len(usable):8} {len(got) - len(usable):8}")

    print(f"\n{'=' * 78}")
    print("BY SPLICE FRACTION - predicted against observed, in sd")
    print("=" * 78)
    print("If mixing worked, predicted and observed would grow together.\n")
    print(f"{'requested':>10} {'n':>6} {'median |predicted|':>19} {'median |observed|':>18}")
    for req in sorted({r["requested"] for r in rows}):
        got = [r for r in rows if r["requested"] == req]
        print(f"{req:10} {len(got):6} "
              f"{median([abs(r['predicted']) for r in got]):19.3f} "
              f"{median([abs(r['observed']) for r in got]):18.3f}")


if __name__ == "__main__":
    main()
