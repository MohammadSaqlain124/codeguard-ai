"""
Build a labelled corpus of synthetic outsourced work.

Every measurement in this folder so far asks "whose file is this" — author
classification. Layer 2 does not do that. It asks "is this file unlike the
other files this student wrote", which is anomaly detection against one
person's own baseline. The README already names the gap in its caveats, and
nothing has ever tested the layer at the job it actually performs, because
there has never been a labelled set of outsourced work to test it on.

This makes one. It takes a file a single author owns and replaces some of its
top-level functions with another author's, which is what outsourcing part of
an assignment looks like from the outside: the submission is mostly yours,
and a section of it is not.

Two design choices carry most of the weight.

**Splices happen at top-level unit boundaries, never at arbitrary lines.** A
line-range splice produces code that does not parse, and a file the detector
cannot parse is not evidence of anything. Top level specifically, because a
top-level function in Python sits at zero indentation in both files, so moving
one needs no reindentation and cannot silently corrupt a block.

**Donor units are size-matched to the ones they replace.** Several of Layer 2's
features are sensitive to length: avg_function_lines, functions_per_100_lines,
avg_line_length. Replace a 40-line function with a 5-line one and the file's
length profile moves for a reason that has nothing to do with authorship. The
layer would then appear to detect outsourcing while actually detecting that
the file got shorter. Donors are kept within SIZE_TOLERANCE of the unit they
replace, and the residual length difference between the two classes is
reported so the next person can see how well that worked rather than trusting
that it did.
"""

import argparse
import json
import os
import random
import sys

from common import attribute, clone_all, select

# app/ lives one level up from this folder and is not an installed package, so
# it has to go on the path before it can be imported. common.py does exactly
# this, and the noqa markers are its convention too: ruff's import sorter would
# otherwise move these above the sys.path line, which is what broke the first
# version of this script.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.parsing import parse_source  # noqa: E402

# What can be lifted out of one file and dropped into another. Classes are
# included because a whole class is a plausible thing to outsource; nested
# definitions are not, because they carry their enclosing indentation.
TOP_LEVEL_LABELS = {
    "python": {"function_definition", "class_definition", "decorated_definition"},
    "java": {"method_declaration", "constructor_declaration", "class_declaration"},
}

# A donor unit may differ from the unit it replaces by this much in lines.
# Loose enough to find a match in most files, tight enough that the length
# profile does not drift.
SIZE_TOLERANCE = 0.30

# Below this the baseline is not a baseline. Matches minAnchorsForBaseline in
# the API's detection config, so the corpus cannot produce cases the running
# system would refuse to score anyway.
MIN_BASELINE_FILES = 3

FRACTIONS = (0.10, 0.25, 0.50)

# Units are coarse: you cannot replace 10% of a file whose smallest function is
# 22% of it. A splice is kept only if what it actually replaced lands within
# this much of what was asked for, so a bucket labelled 0.10 contains splices
# near 0.10 rather than whatever the file happened to allow. Files too coarse
# for a given fraction are discarded and counted instead of silently widening
# the bucket.
FRACTION_TOLERANCE = 0.5

# How many donor files to try before giving up on a target. One donor is not
# enough: a target with four large functions needs a donor that happens to
# carry four similarly sized ones, and most do not. Trying several costs
# nothing and turns most discards back into usable splices.
DONOR_ATTEMPTS = 6


def read_source(path):
    """Source as text, or None if it is not decodable as UTF-8."""
    try:
        return open(path, "rb").read().decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def top_level_units(source, language):
    """
    Line ranges of the units that can be moved between files.

    Returns (start, end) pairs, both inclusive and zero-based, in the order
    they appear. Only direct children of the root, so nothing returned here is
    indented inside anything else.
    """
    result = parse_source(language, source)
    # ok rather than root, because tree-sitter returns a tree for nonsense too:
    # parse_source hands back the broken root alongside ok=False, so testing
    # root for None only catches a missing grammar.
    if not result.ok or result.root is None:
        return []
    labels = TOP_LEVEL_LABELS[language]
    return [
        (node.start_point[0], node.end_point[0])
        for node in result.root.children
        if node.type in labels
    ]


def unit_lines(span):
    start, end = span
    return end - start + 1


def pick_donor(donor_spans, wanted, used):
    """
    The unused donor unit closest in size to `wanted`, or None.

    Closest rather than first-that-fits, so a file with many candidates gives
    up the least length drift rather than whichever one happened to come
    first.
    """
    best = None
    for index, span in enumerate(donor_spans):
        if index in used:
            continue
        size = unit_lines(span)
        if abs(size - wanted) > wanted * SIZE_TOLERANCE:
            continue
        gap = abs(size - wanted)
        if best is None or gap < best[0]:
            best = (gap, index)
    return None if best is None else best[1]


def splice(target_src, donor_src, language, fraction, rng):
    """
    Replace roughly `fraction` of the target's lines with the donor's units.

    Returns (spliced source, lines replaced) or None when the pair cannot
    produce a usable splice — too few units, no size-matched donors, or a
    result that no longer parses. Returning None rather than a degraded splice
    matters: a corpus quietly padded with broken or trivial cases would make
    the layer look worse than it is for reasons unrelated to style.
    """
    target_spans = top_level_units(target_src, language)
    donor_spans = top_level_units(donor_src, language)
    if not target_spans or not donor_spans:
        return None

    target_lines = target_src.count("\n") + 1
    budget = target_lines * fraction

    donor_text = donor_src.split("\n")
    target_text = target_src.split("\n")

    order = list(range(len(target_spans)))
    rng.shuffle(order)

    used_donors = set()
    replacements = []
    replaced = 0

    ceiling = budget * (1 + FRACTION_TOLERANCE)
    floor = budget * (1 - FRACTION_TOLERANCE)

    for index in order:
        if replaced >= budget:
            break
        span = target_spans[index]
        wanted = unit_lines(span)
        # Taking this unit must not carry the splice past the ceiling. Without
        # this one oversized unit drags a 10% request up to 40% and the bucket
        # stops meaning anything.
        if replaced + wanted > ceiling:
            continue
        donor_index = pick_donor(donor_spans, wanted, used_donors)
        if donor_index is None:
            continue
        used_donors.add(donor_index)
        d_start, d_end = donor_spans[donor_index]
        replacements.append((span, donor_text[d_start:d_end + 1]))
        replaced += wanted

    if not replacements or replaced < floor:
        return None

    # Apply from the bottom up so earlier line numbers stay valid.
    replacements.sort(key=lambda r: r[0][0], reverse=True)
    out = list(target_text)
    for (start, end), block in replacements:
        out[start:end + 1] = block

    spliced = "\n".join(out)

    # The corpus is only useful if the detector can read it. A splice that
    # breaks the parse is discarded and counted, never written.
    if not parse_source(language, spliced).ok:
        return None

    return spliced, replaced


def by_author(rows):
    groups = {}
    for row in rows:
        groups.setdefault(row["author"], []).append(row)
    return groups


def build(rows, language, fractions, seed, out_dir):
    """
    One clean and one spliced version of each held-out file, per fraction.

    Each author's files are split into a baseline and a held-out part. The
    baseline is what Layer 2 would have as the student's history; the held-out
    files are the submissions under test. The clean and spliced versions of one
    file share a pair_id, so the analysis can treat them as a matched pair or
    as independent samples. That choice is deliberately left open: pairing is
    statistically stronger, and it also means near-identical content appears
    twice in one run, which can leak. Whoever runs the ablation should decide
    and say which they used.
    """
    rng = random.Random(seed)
    groups = by_author(rows)
    authors = sorted(groups)

    items = []
    discarded = 0
    pair = 0

    for author in authors:
        files = sorted(groups[author], key=lambda r: r["path"])
        if len(files) < MIN_BASELINE_FILES + 1:
            continue
        rng.shuffle(files)
        baseline = files[:MIN_BASELINE_FILES]
        held_out = files[MIN_BASELINE_FILES:]

        donors = [a for a in authors if a != author and len(groups[a]) > 0]
        if not donors:
            continue

        for row in held_out:
            target_src = read_source(row["path"])
            if target_src is None:
                continue

            for fraction in fractions:
                result = None
                donor_author = None
                for _ in range(DONOR_ATTEMPTS):
                    donor_author = rng.choice(donors)
                    donor_row = rng.choice(groups[donor_author])
                    donor_src = read_source(donor_row["path"])
                    if donor_src is None:
                        continue
                    result = splice(target_src, donor_src, language, fraction, rng)
                    if result is not None:
                        break
                if result is None:
                    discarded += 1
                    continue
                spliced_src, replaced = result

                pair += 1
                base = f"{language}-{pair:05d}"
                clean_path = os.path.join(out_dir, f"{base}-clean{_ext(language)}")
                dirty_path = os.path.join(out_dir, f"{base}-spliced{_ext(language)}")
                _write(clean_path, target_src)
                _write(dirty_path, spliced_src)

                shared = {
                    "pair_id": pair,
                    "language": language,
                    "author": author,
                    "baseline_paths": [b["path"] for b in baseline],
                    "source_path": row["path"],
                    "requested_fraction": fraction,
                }
                items.append({
                    **shared,
                    "id": f"{base}-clean",
                    "label": "clean",
                    "donor": None,
                    "actual_fraction": 0.0,
                    "lines": target_src.count("\n") + 1,
                    "path": clean_path,
                })
                items.append({
                    **shared,
                    "id": f"{base}-spliced",
                    "label": "spliced",
                    "donor": donor_author,
                    "actual_fraction": round(replaced / (target_src.count("\n") + 1), 4),
                    "lines": spliced_src.count("\n") + 1,
                    "path": dirty_path,
                })

    return items, discarded


def _ext(language):
    return ".py" if language == "python" else ".java"


def _write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def report(items, discarded):
    """What the corpus actually contains, including the parts that went wrong."""
    clean = [i for i in items if i["label"] == "clean"]
    spliced = [i for i in items if i["label"] == "spliced"]
    print(f"pairs written      {len(clean)}")
    print(f"discarded splices  {discarded}")
    if not spliced:
        print("nothing to report")
        return

    authors = {i["author"] for i in items}
    print(f"authors            {len(authors)}")

    print("\nby requested fraction")
    print(f"  {'wanted':>7}  {'pairs':>6}  {'median actual':>14}")
    for fraction in sorted({i["requested_fraction"] for i in spliced}):
        got = sorted(i["actual_fraction"] for i in spliced if i["requested_fraction"] == fraction)
        median = got[len(got) // 2] if got else 0
        print(f"  {fraction:>7.2f}  {len(got):>6}  {median:>14.3f}")

    # The confound check. If spliced files are systematically longer or
    # shorter than their clean counterparts, any detection result could be
    # length rather than style, and this is the number that says so.
    by_pair = {}
    for item in items:
        by_pair.setdefault(item["pair_id"], {})[item["label"]] = item["lines"]
    deltas = [
        v["spliced"] - v["clean"]
        for v in by_pair.values()
        if "spliced" in v and "clean" in v
    ]
    deltas.sort()
    if deltas:
        median = deltas[len(deltas) // 2]
        print("\nlength delta spliced minus clean, lines")
        print(f"  median {median}   min {deltas[0]}   max {deltas[-1]}")
        print("  a median far from zero means length, not style, may be doing the work")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--language", required=True, choices=("python", "java"))
    ap.add_argument("--work", required=True, help="where the repositories are")
    ap.add_argument("--out", required=True, help="where to write the corpus")
    ap.add_argument("--skip-clone", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument(
        "--rows-cache",
        help="json file to save the git blame attribution to, and reuse next run",
    )
    ap.add_argument(
        "--fractions",
        default=",".join(str(f) for f in FRACTIONS),
        help="comma separated share of lines to replace",
    )
    args = ap.parse_args()

    if args.language == "python":
        from python_authorship import PYTHON as cfg
    else:
        from java_authorship import JAVA as cfg

    if not args.skip_clone:
        clone_all(cfg, args.work)

    # Attribution blames every candidate file, which is about 70 ms each and
    # two to three minutes over the Python set, printing nothing while it runs.
    # It does not depend on the seed, so caching it turns a three minute wait
    # on every run into one wait and then nothing. Anyone tuning fractions will
    # run this many times.
    attributed = None
    if args.rows_cache and os.path.exists(args.rows_cache):
        with open(args.rows_cache, encoding="utf-8") as handle:
            attributed = json.load(handle)
        print(f"reusing attribution for {len(attributed)} files from {args.rows_cache}")

    if attributed is None:
        print("blaming every candidate file, two to three minutes, no output until done")
        attributed = attribute(args.work, cfg)
        print(f"attributed {len(attributed)} files")
        if args.rows_cache:
            with open(args.rows_cache, "w", encoding="utf-8") as handle:
                json.dump(attributed, handle)
            print(f"saved to {args.rows_cache}")

    # select returns three things, not a list: every single-author file, the
    # per-author counts, and the capped selection. The last one is the sample
    # the authorship measurements actually run on, so it is the one to splice.
    single, counts, rows = select(attributed, seed=args.seed)
    authors = len({r["author"] for r in rows})
    print(f"{len(single)} single-author files, {len(rows)} kept after the cap, {authors} authors")
    print("building splices")

    os.makedirs(args.out, exist_ok=True)
    fractions = tuple(float(f) for f in args.fractions.split(","))
    items, discarded = build(rows, args.language, fractions, args.seed, args.out)

    manifest = os.path.join(args.out, f"manifest-{args.language}.json")
    with open(manifest, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "language": args.language,
                "seed": args.seed,
                "fractions": list(fractions),
                "min_baseline_files": MIN_BASELINE_FILES,
                "size_tolerance": SIZE_TOLERANCE,
                "discarded": discarded,
                "items": items,
            },
            handle,
            indent=2,
        )

    report(items, discarded)
    print(f"\nmanifest {manifest}")


if __name__ == "__main__":
    main()
