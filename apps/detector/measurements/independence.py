"""
Do Layer 1 and Layer 2 carry independent signal, and is the corpus confounded?

The RPS adds the layers with fixed weights, which assumes each one says
something the other does not. If the two scores moved together there would be
no point weighting them separately: the combination would be one signal counted
twice, and the renormalisation would be dressing it up as two.

This reads the per-item scores `ablation.py --save` wrote and answers three
questions that all depend only on those scores, so none of them needs the
forty-minute run repeated:

  independence     correlation between the two layers' scores. Near zero means
                   the weighting assumption holds. Read it with care: two
                   signals are also uncorrelated when one of them is noise, so
                   independence is necessary for the design to make sense and
                   is not on its own evidence that combining them helps.

  dose-response    correlation between how much of a file was actually
                   outsourced and how much each layer's score moved. This uses
                   actual_fraction continuously, so unlike a bucketed test it
                   does not depend on where the bucket edges fall. The corpus
                   README is explicit that the requested fraction is a design
                   label and the actual one is what an analysis should use.

  length confound  the check measurements/README.md asked anyone reporting a
                   detection result from this corpus to run. Three of the
                   extracted features are length-sensitive, so a layer could
                   appear to detect outsourcing while detecting that the file
                   changed size. Correlating the score delta against the line
                   delta says whether that happened.

    python measurements/independence.py --scores E:\\temp\\ablation-python.json
"""

import argparse
import json
import math


def pearson(xs, ys):
    """Linear correlation. Hand-rolled: the detector has no numpy on purpose."""
    n = len(xs)
    if n < 3:
        return float("nan")
    mx, my = sum(xs) / n, sum(ys) / n
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return float("nan")
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True)) / (sx * sy)


def ranks(values):
    """Ranks with ties averaged, which is what Spearman needs."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        average = (i + j) / 2 + 1
        for k in range(i, j + 1):
            out[order[k]] = average
        i = j + 1
    return out


def spearman(xs, ys):
    """Rank correlation, so a monotone but bent relationship still shows."""
    return pearson(ranks(xs), ranks(ys))


def describe(r):
    """Plain words for a correlation, so a number is not read as a verdict."""
    if r != r:
        return "undefined"
    size = abs(r)
    if size < 0.1:
        return "none to speak of"
    if size < 0.3:
        return "weak"
    if size < 0.5:
        return "moderate"
    return "strong"


def paired(rows):
    """Both versions of each pair, keyed by pair_id, complete pairs only."""
    pairs = {}
    for row in rows:
        pairs.setdefault(row["pair_id"], {})[row["label"]] = row
    return [v for v in pairs.values() if "clean" in v and "spliced" in v]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scores", required=True, help="the --save json from ablation.py")
    args = ap.parse_args()

    with open(args.scores, encoding="utf-8") as handle:
        saved = json.load(handle)
    print(f"scores from {args.scores}")
    print(f"draws {saved['draws']}, pool {saved['pool']}, seed {saved['seed']}")

    print(f"\n{'=' * 74}")
    print("INDEPENDENCE - does Layer 2 say anything Layer 1 does not")
    print("=" * 74)
    for condition, rows in saved["conditions"].items():
        print(f"\n  {condition}")
        for label in ("clean", "spliced", None):
            subset = [r for r in rows if label is None or r["label"] == label]
            if len(subset) < 3:
                continue
            l1 = [r["l1"] for r in subset]
            l2 = [r["l2"] for r in subset]
            p, s = pearson(l1, l2), spearman(l1, l2)
            print(f"    {label or 'both':8} n={len(subset):4}  pearson {p:+.4f}  "
                  f"spearman {s:+.4f}   {describe(p)}")

    rows = saved["conditions"].get("donor-excluded") or next(
        iter(saved["conditions"].values())
    )
    full = paired(rows)

    print(f"\n{'=' * 74}")
    print("DOSE-RESPONSE - does a score move further when more was outsourced")
    print("=" * 74)
    print("Measured against actual_fraction, continuously, so no bucket edge")
    print(f"decides the answer. {len(full)} complete pairs.\n")
    fraction = [v["spliced"]["actual_fraction"] for v in full]
    for key, name in (("l1", "Layer 1"), ("l2", "Layer 2"), ("rps", "RPS")):
        delta = [v["spliced"][key] - v["clean"][key] for v in full]
        p, s = pearson(fraction, delta), spearman(fraction, delta)
        print(f"  {name:8} pearson {p:+.4f}  spearman {s:+.4f}   {describe(p)}")

    print(f"\n{'=' * 74}")
    print("LENGTH CONFOUND - is a score tracking size rather than style")
    print("=" * 74)
    print("Signed delta asks whether growing or shrinking moves the score.")
    print("Absolute delta asks whether changing size at all does.\n")
    signed = [v["spliced"]["lines"] - v["clean"]["lines"] for v in full]
    absolute = [abs(x) for x in signed]
    print(f"  {'':8} {'signed':>10} {'absolute':>10}   {'r2 of the larger':>18}")
    for key, name in (("l1", "Layer 1"), ("l2", "Layer 2"), ("rps", "RPS")):
        delta = [v["spliced"][key] - v["clean"][key] for v in full]
        ps, pa = pearson(signed, delta), pearson(absolute, delta)
        worst = max(abs(ps), abs(pa))
        print(f"  {name:8} {ps:+10.4f} {pa:+10.4f}   {worst ** 2:17.1%}")

    median_lines = sorted(absolute)[len(absolute) // 2]
    print(f"\n  median absolute line delta: {median_lines} lines")


if __name__ == "__main__":
    main()
