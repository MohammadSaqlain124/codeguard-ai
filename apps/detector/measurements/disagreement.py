"""
How wide should signalDisagreement's margin be?

`detection.ts` records a disagreement when the two layers land on opposite
sides of the review threshold:

    signalDisagreement =
      structuralOk && behaviouralOk &&
      (best >= reviewThreshold) !== (behaviouralScore >= reviewThreshold)

The reasoning is sound — two layers that both ran and reached opposite
conclusions are not a middling case, and an average hides that. But the test
has no margin, so two scores of 0.4999 and 0.5001 are recorded as two
confident and opposite findings when they are the same finding either side of
a line. That is the "fires on boundary artefacts" complaint, open since
File 098 and never measured.

This measures it. For a range of margins it asks how many firings survive a
requirement that **both** layers sit at least that far from the threshold, and
how far from the threshold the firings actually are. A margin that removes a
large share of firings while leaving the distribution's bulk intact is
separating artefacts from findings; one that removes almost nothing means the
complaint was unfounded and the margin is not worth adding.

Reads the per-item scores `ablation.py --save` wrote, so it needs no re-run.

    python measurements/disagreement.py --scores E:\\temp\\ablation-python.json
"""

import argparse
import json
import statistics

# Swept because the configured review threshold is per course and per language,
# so a single value would answer the question for one configuration only.
THRESHOLDS = (0.40, 0.50, 0.60)
MARGINS = (0.00, 0.01, 0.02, 0.05, 0.10, 0.15, 0.20, 0.30)


def fires(l1, l2, threshold, margin):
    """Opposite sides of the threshold, and both clear of it by `margin`."""
    if abs(l1 - threshold) < margin or abs(l2 - threshold) < margin:
        return False
    return (l1 >= threshold) != (l2 >= threshold)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scores", required=True, help="the --save json from ablation.py")
    ap.add_argument("--condition", default="donor-excluded")
    args = ap.parse_args()

    with open(args.scores, encoding="utf-8") as handle:
        saved = json.load(handle)
    conditions = saved["conditions"]
    rows = conditions.get(args.condition) or next(iter(conditions.values()))
    scored = [r for r in rows if isinstance(r.get("l1"), (int, float))
              and isinstance(r.get("l2"), (int, float))]
    print(f"{len(scored)} scored files from {args.scores} ({args.condition})")

    print(f"\n{'=' * 70}")
    print("FIRING RATE AGAINST MARGIN")
    print("=" * 70)
    print("Both layers must sit at least `margin` clear of the threshold before")
    print("a disagreement is recorded. Margin 0.00 is the behaviour today.\n")
    header = "  " + f"{'margin':>8}" + "".join(f"{f'T={t:.2f}':>12}" for t in THRESHOLDS)
    print(header)
    baseline = {}
    for margin in MARGINS:
        cells = []
        for threshold in THRESHOLDS:
            n = sum(1 for r in scored if fires(r["l1"], r["l2"], threshold, margin))
            if margin == 0.0:
                baseline[threshold] = n
            base = baseline.get(threshold, 0)
            share = f"{n / base:.0%}" if base else "-"
            cells.append(f"{n:5d} ({share:>4})")
        print(f"  {margin:8.2f}" + "".join(f"{c:>12}" for c in cells))

    print(f"\n{'=' * 70}")
    print("HOW CLOSE TO THE LINE THE FIRINGS ACTUALLY ARE")
    print("=" * 70)
    print("For firings at margin 0, the distance from the threshold of whichever")
    print("layer sits nearer to it. Small values are the boundary artefacts.\n")
    print(f"  {'threshold':>10} {'firings':>8} {'p10':>8} {'median':>8} {'p90':>8}")
    for threshold in THRESHOLDS:
        gaps = sorted(
            min(abs(r["l1"] - threshold), abs(r["l2"] - threshold))
            for r in scored if fires(r["l1"], r["l2"], threshold, 0.0)
        )
        if not gaps:
            print(f"  {threshold:10.2f} {0:8d}        no firings")
            continue
        print(f"  {threshold:10.2f} {len(gaps):8d} "
              f"{gaps[len(gaps) // 10]:8.4f} {statistics.median(gaps):8.4f} "
              f"{gaps[9 * len(gaps) // 10]:8.4f}")

    print(f"\n{'=' * 70}")
    print("ARE THE TWO LAYERS EVEN ON THE SAME SCALE?")
    print("=" * 70)
    print("One shared threshold assumes both layers put a comparable submission")
    print("in a comparable place. If one layer sits almost entirely on one side,")
    print("the flag is reporting a distribution mismatch and not a disagreement.\n")
    print(f"  {'layer':8} {'median':>8} {'p10':>8} {'p90':>8}"
          + "".join(f"{f'above {t:.2f}':>13}" for t in THRESHOLDS))
    for key, label in (("l1", "Layer 1"), ("l2", "Layer 2")):
        vals = sorted(r[key] for r in scored)
        shares = "".join(
            f"{sum(1 for v in vals if v >= t) / len(vals):12.0%} " for t in THRESHOLDS
        )
        print(f"  {label:8} {statistics.median(vals):8.4f} "
              f"{vals[len(vals) // 10]:8.4f} {vals[9 * len(vals) // 10]:8.4f} {shares}")

    print(f"\n{'=' * 70}")
    print("READING THIS")
    print("=" * 70)
    print("If the median gap is large and few firings are lost to a small margin,")
    print("the firings are real disagreements and the margin is not needed. If a")
    print("margin of 0.02 to 0.05 removes a large share, those firings were the")
    print("two layers agreeing either side of a line, and the margin belongs in")
    print("detection.ts. Choose it from this table rather than by taste, and")
    print("record the chosen value and this run beside it.")
    print("\nNote: these scores come from the style-shift corpus, where Layer 2")
    print("carries no signal (Chapter 7). The firing rate here is therefore a")
    print("measure of how often two near-arbitrary scores straddle a line, which")
    print("is exactly the artefact being asked about, but it is not a sample of")
    print("real coursework and the absolute counts should not be read as one.")


if __name__ == "__main__":
    main()
