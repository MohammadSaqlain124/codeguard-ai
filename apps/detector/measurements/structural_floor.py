"""What is the floor under Layer 1's similarity score?

Layer 1 reports `1 - distance / (size_a + size_b)`. APTED relabels a node for a
cost of 1 where deleting it and inserting another costs 2, so two unrelated
trees of similar size sit about one size apart rather than two, and the score
for unrelated code is not near zero. Day 25's demo run showed two honest
invigilated submissions at 0.6074 and 0.5796, both past the 0.5 review
threshold, from four students who had simply been set the same problem.

Nothing has ever measured that floor, so `w1 = 0.4` is applied to a score whose
zero point is unknown. This measures it, in the three forms the corpora can
support:

  same repository, different author   shared conventions, different people.
                                      The closest thing here to a classroom.
  different repository, different     unrelated code. The absolute floor.
  author
  same author, different file         whether one person's own work looks
                                      copied from itself, which is what a
                                      student's two submissions are.

WHAT THIS DOES NOT MEASURE. Every pair here solves a *different* problem. A
class is set one problem, so the real classroom floor is higher than anything
below, and the same-repository figure is a lower bound rather than an estimate.
Say so wherever these numbers are quoted.

Everything about corpus selection comes from common.py, so this samples exactly
the files the Layer 2 measurements sampled.

Run it from apps/detector, reusing the clones the authorship runs made:

    python measurements/structural_floor.py --language python --work /tmp/pyrepos --skip-clone

This is the expensive measurement in the project. Tree edit distance is not
cheap and this does it for hundreds of file pairs, so expect tens of minutes.
Lower --pairs to trade precision for time.
"""
import argparse
import os
import random
import statistics
import sys
import time
from itertools import combinations

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common import MAX_LINES, MIN_LINES, attribute, clone_all, posix, select  # noqa: E402

from app.normalise import normalise, size  # noqa: E402
from app.parsing import parse_source  # noqa: E402
from app.units import compare_files  # noqa: E402

# The thresholds worth knowing the exceedance of. 0.5 is reviewThreshold in
# DetectionConfig.ts, which is the one that decides signalDisagreement.
THRESHOLDS = (0.5, 0.6, 0.7, 0.8, 0.9)


def prepared(rows, language):
    """Parse and normalise once per file, since each file appears in many pairs."""
    out, failed = [], 0
    for r in rows:
        source = open(r["path"], "rb").read().decode("utf-8", "replace")
        parsed = parse_source(language, source)
        if not parsed.ok:
            failed += 1
            continue
        root = normalise(parsed.root)
        if root is None:
            failed += 1
            continue
        out.append({**r, "root": root, "nodes": size(root)})
    return out, failed


def pools(files):
    """The three pair categories, as index pairs into `files`."""
    same_repo_other_author = []
    other_repo_other_author = []
    same_author = []
    for i, j in combinations(range(len(files)), 2):
        a, b = files[i], files[j]
        if a["author"] == b["author"]:
            same_author.append((i, j))
        elif a["repo"] == b["repo"]:
            same_repo_other_author.append((i, j))
        else:
            other_repo_other_author.append((i, j))
    return {
        "same repo, different author": same_repo_other_author,
        "different repo, different author": other_repo_other_author,
        "same author, different file": same_author,
    }


def sample(pairs, wanted, seed):
    """A seeded sample, sorted first so the choice does not depend on dict order."""
    ordered = sorted(pairs)
    if len(ordered) <= wanted:
        return ordered
    return random.Random(seed).sample(ordered, wanted)


def describe(values):
    """Quartiles without crashing on a short list."""
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) < 4:
        return dict(n=len(ordered), lo=ordered[0], p25=None, med=statistics.median(ordered),
                    p75=None, p90=None, hi=ordered[-1], mean=statistics.fmean(ordered))
    q = statistics.quantiles(ordered, n=100, method="inclusive")
    return dict(n=len(ordered), lo=ordered[0], p25=q[24], med=statistics.median(ordered),
                p75=q[74], p90=q[89], hi=ordered[-1], mean=statistics.fmean(ordered))


def run_category(label, pairs, files, language, seed, wanted):
    chosen = sample(pairs, wanted, seed)
    print(f"\n{label}")
    print(f"  pairs available {len(pairs)}, measuring {len(chosen)}")

    scored = []
    uncompared = 0
    started = time.perf_counter()
    for n, (i, j) in enumerate(chosen, start=1):
        a, b = files[i], files[j]
        outcome = compare_files(a["root"], b["root"], language)
        # A pair whose only matched units were size pruned reports 0.0, which is
        # not a similarity of zero but a comparison that never happened. Folding
        # those into the distribution would drag the floor down with values that
        # mean nothing, so they are counted separately. This is the same
        # distinction behavioural.ts keeps between a skipped layer and a clean
        # one, which the structural layer does not make for itself.
        if outcome.compared_pairs == 0:
            uncompared += 1
        else:
            scored.append(outcome.similarity)
        if n % 20 == 0:
            rate = (time.perf_counter() - started) / n
            left = rate * (len(chosen) - n)
            print(f"    {n}/{len(chosen)}  {rate:.2f}s per pair, about {left / 60:.1f} min left")

    elapsed = time.perf_counter() - started
    print(f"  done in {elapsed / 60:.1f} min, {uncompared} pairs never actually compared")

    stats = describe(scored)
    if stats is None:
        print("  nothing was comparable in this category")
        return label, None

    print(f"  n {stats['n']}   min {stats['lo']:.4f}   median {stats['med']:.4f}"
          f"   mean {stats['mean']:.4f}   max {stats['hi']:.4f}")
    if stats["p25"] is not None:
        print(f"  p25 {stats['p25']:.4f}   p75 {stats['p75']:.4f}   p90 {stats['p90']:.4f}")
    for t in THRESHOLDS:
        over = sum(1 for v in scored if v >= t)
        print(f"  at or above {t:.1f}   {over:5d} of {stats['n']}   {over / stats['n']:6.1%}")
    return label, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--language", required=True, choices=("python", "java"))
    ap.add_argument("--work", required=True, help="where the clones live")
    ap.add_argument("--skip-clone", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--pairs", type=int, default=100,
                    help="pairs measured per category. tree edit distance is "
                         "the cost here, so this is the time knob")
    # A library module with twenty functions pairs up differently from a
    # coursework file with two, and the unit matching is where the score comes
    # from. So the floor is worth reading once over the whole corpus and once
    # restricted to the size a real submission actually is.
    ap.add_argument("--min-lines", type=int, default=MIN_LINES)
    ap.add_argument("--max-lines", type=int, default=MAX_LINES)
    args = ap.parse_args()

    if args.language == "python":
        from python_authorship import PYTHON as cfg
    else:
        from java_authorship import JAVA as cfg

    if not args.skip_clone:
        print("CLONING (full history, single branch)")
        clone_all(cfg, args.work)

    print("\nSELECTING the same files the Layer 2 measurements used")
    rows = attribute(args.work, cfg)
    single, counts, kept = select(rows, seed=args.seed)
    print(f"  candidates {len(rows)}, single author {len(single)}, selected {len(kept)}")

    if (args.min_lines, args.max_lines) != (MIN_LINES, MAX_LINES):
        before = len(kept)
        kept = [r for r in kept if args.min_lines <= r["lines"] <= args.max_lines]
        print(f"  restricted to {args.min_lines}-{args.max_lines} lines: "
              f"{len(kept)} of {before}")

    print("\nPARSING and normalising once per file")
    files, failed = prepared(kept, cfg.name)
    files.sort(key=lambda r: (r["repo"], r["author"], posix(r["path"])))
    print(f"  usable {len(files)} of {len(kept)}, {failed} failed to parse or normalise")
    nodes = [r["nodes"] for r in files]
    if nodes:
        print(f"  normalised node counts: min {min(nodes)}, median "
              f"{statistics.median(nodes):.0f}, max {max(nodes)}")

    repos = len({r["repo"] for r in files})
    authors = len({r["author"] for r in files})
    print(f"  spread over {repos} repositories and {authors} authors")

    by_category = pools(files)
    print("\nPAIRS AVAILABLE")
    for label, pairs in by_category.items():
        print(f"  {label:34s} {len(pairs):8d}")

    results = {}
    print("\nMEASURING with the detector's own comparison, production settings")
    for label, pairs in by_category.items():
        if not pairs:
            print(f"\n{label}\n  no pairs in this category")
            continue
        name, stats = run_category(label, pairs, files, cfg.name, args.seed, args.pairs)
        results[name] = stats

    print("\n" + "=" * 70)
    print("THE FLOOR")
    print("=" * 70)
    if not any(s is not None for s in results.values()):
        print("  Nothing was measurable with these filters, so there is no result "
              "here.\n  Widen --min-lines and --max-lines.")
        return
    for label, stats in results.items():
        if stats is None:
            continue
        # an explicit None test, not `or`: a p90 that is genuinely 0.0 is falsy
        p90 = "n/a" if stats["p90"] is None else f"{stats['p90']:.4f}"
        print(f"  {label:34s} median {stats['med']:.4f}   p90 {p90}")

    classroom = results.get("same repo, different author")
    if classroom:
        print("\n  The same-repository figure is the closest proxy available here for a")
        print("  classroom: shared conventions, different people. Its median is")
        print(f"  {classroom['med']:.4f} and its 90th percentile {classroom['p90']:.4f}.")
        print("  Every pair measured solves a DIFFERENT problem, so a class set one")
        print("  problem will sit higher than this. Treat it as a lower bound.")
    print("\n  Quote these as measured on this corpus with this seed and this many")
    print("  pairs, and re-run with another --seed before trusting the third decimal.")


if __name__ == "__main__":
    main()
