"""Shared machinery for the authorship measurements.

Both language scripts import this, so the Java and Python runs are not merely
described as using the same method, they run the same code. Anything that
differs between the two languages lives in a Language config in the calling
script and nothing else does.

The feature extractor itself is already language-agnostic: app/features.py
unions every language's node labels rather than branching on the language, so
the same extract_features call serves both.
"""
import argparse
import json
import os
import random
import re
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.features import FEATURE_NAMES, extract_features  # noqa: E402
from app.parsing import parse_source  # noqa: E402

# The Day 19 Python run's selection rules, kept identical for both languages so
# that the two measurements are comparable.
MIN_LINES, MAX_LINES = 30, 700
MIN_SHARE = 0.85
MIN_FILES_PER_AUTHOR = 4
MAX_FILES_PER_AUTHOR = 12

# The four features behavioural.ts actually scores, chosen on the Python data.
SCORED = ("blank_line_ratio", "avg_line_length", "max_block_depth",
          "comment_density")

# 80-250 is the band the Day 19 run derived; the others ask whether a narrower
# or lower band does better. The same list is used for both languages so the
# answers can be compared.
BANDS = ((80, 250), (50, 150), (40, 120), (30, 100))


@dataclass
class Language:
    """Everything that differs between one language's measurement and another."""

    name: str                       # the key app.parsing.parse_source expects
    extension: str                  # which source files to consider
    repos: list[str]                # owner/name slugs to clone
    # One person commits under several names. Merging them matters: without it
    # one author looks like three, which moves within-author variance into the
    # between-author term and understates every result.
    aliases: dict[str, str] = field(default_factory=dict)
    excluded_dirs: tuple[str, ...] = ()
    excluded_suffixes: tuple[str, ...] = ()
    excluded_prefixes: tuple[str, ...] = ()
    excluded_names: tuple[str, ...] = ()


def posix(path):
    """Separator independent path, so sorting does not depend on the os.

    Windows gives os.walk backslashes and posix gives forward slashes, and the
    two sort differently against the other path characters: "src/main/java/"
    comes before "src/main/java11/" but "src\\main\\java\\" comes after. With a
    cap per author that chooses a different twelve files on each os, which is
    how this was found.

    Replaces the backslash rather than os.sep, because os.sep is itself the
    running platform's separator: using it here would leave a windows path
    untouched on linux, which is the same bug one level up.
    """
    return path.replace("\\", "/")


def is_excluded(rel, cfg):
    """Test files, generated files and vendored code are not the author's style."""
    clean = posix(rel)
    if any(d in "/" + clean.lower() for d in cfg.excluded_dirs):
        return True
    # not os.path.basename: that splits on the running platform's separator,
    # so it would return the whole string for a path from the other one
    base = clean.rsplit("/", 1)[-1]
    return (base in cfg.excluded_names
            or base.endswith(cfg.excluded_suffixes)
            or base.startswith(cfg.excluded_prefixes))


def normalise_name(name):
    """Lowercase, strip punctuation, so 'Gary D. Gregory' and 'gary d gregory' match."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", name.lower().strip()))


def clone_all(cfg, work):
    os.makedirs(work, exist_ok=True)
    for slug in cfg.repos:
        name = slug.split("/")[1]
        dest = os.path.join(work, name)
        if os.path.isdir(dest):
            print(f"  {name:18s} already present")
            continue
        subprocess.run(["git", "clone", "--single-branch", "-q",
                        f"https://github.com/{slug}.git", dest], check=True)
        print(f"  {name:18s} cloned")


def attribute(work, cfg):
    """Every candidate file with the author who owns most of its surviving lines."""
    rows = []
    for repo in sorted(os.listdir(work)):
        root_dir = os.path.join(work, repo)
        if not os.path.isdir(root_dir):
            continue
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d != ".git"]
            for name in files:
                if not name.endswith(cfg.extension):
                    continue
                path = os.path.join(root, name)
                rel = os.path.relpath(path, root_dir)
                if is_excluded(rel, cfg):
                    continue
                raw = open(path, "rb").read()
                lines = raw.count(b"\n") + (0 if raw.endswith(b"\n") else 1)
                if not MIN_LINES <= lines <= MAX_LINES:
                    continue
                # -w so a reformatting commit does not reassign the whole file
                # to whoever ran the formatter
                out = subprocess.run(
                    ["git", "-C", root_dir, "blame", "-w", "--line-porcelain",
                     "--", rel], capture_output=True)
                if out.returncode != 0:
                    continue
                authors = Counter()
                for line in out.stdout.split(b"\n"):
                    if line.startswith(b"author "):
                        who = line[7:].strip().decode("utf-8", "replace")
                        # alias per line, before the share is worked out. doing
                        # it afterwards on the winner only is a bug: one human
                        # under two spellings gets counted as two authors, which
                        # deflates the top share and can push the file below
                        # MIN_SHARE and out of the sample entirely.
                        name = normalise_name(who)
                        authors[cfg.aliases.get(name, name)] += 1
                if not authors:
                    continue
                top, owned = authors.most_common(1)[0]
                rows.append({
                    "repo": repo, "path": path, "lines": lines,
                    "author": top,
                    "share": owned / sum(authors.values()),
                })
    return rows


def select(rows, seed=0):
    """Single-author files, from authors with enough of them, capped per author.

    The cap is the awkward part. Some authors have hundreds of eligible files
    and we keep twelve, so the choice of twelve is a sample and the result
    depends on it. Taking the alphabetically first twelve is the worst option
    available: nearby paths sit in the same package, and files in one package
    resemble each other more than the author's work in general does. So sort for
    determinism, then shuffle with a stated seed, and let --draws report how
    much the answer moves across seeds.
    """
    single = [r for r in rows if r["share"] >= MIN_SHARE]
    counts = Counter(r["author"] for r in single)
    enough = {a for a, c in counts.items() if c >= MIN_FILES_PER_AUTHOR}
    by_author = defaultdict(list)
    for r in single:
        if r["author"] in enough:
            by_author[r["author"]].append(r)
    rnd = random.Random(seed)
    kept = []
    for author in sorted(by_author):
        files = sorted(by_author[author], key=lambda r: posix(r["path"]))
        rnd.shuffle(files)
        kept += files[:MAX_FILES_PER_AUTHOR]
    return single, counts, kept


def measure(rows, cfg, cache=None):
    """Run every selected file through the detector's own feature extractor.

    The cache is keyed on path so that --draws, whose selections overlap
    heavily, parses each file once rather than once per draw.
    """
    if cache is None:
        cache = {}
    out, failed = [], 0
    for r in rows:
        if r["path"] not in cache:
            source = open(r["path"], "rb").read().decode("utf-8", "replace")
            parsed = parse_source(cfg.name, source)
            cache[r["path"]] = (extract_features(parsed.root, source.encode("utf-8"))
                                if parsed.ok else None)
        values = cache[r["path"]]
        if values is None:
            failed += 1
            continue
        out.append({**r, "features": values})
    return out, failed


def within_author_cv(rows, feature):
    per = defaultdict(list)
    for r in rows:
        value = r["features"][feature]
        if value is not None:
            per[r["author"]].append(float(value))
    cvs = []
    for values in per.values():
        if len(values) < 2:
            continue
        arr = np.array(values)
        if arr.mean() != 0:
            cvs.append(arr.std(ddof=1) / abs(arr.mean()))
    return float(np.mean(cvs)) if cvs else float("nan")


def f_ratio(rows, feature):
    """One-way ANOVA F: between-author variance over within-author variance."""
    per = defaultdict(list)
    for r in rows:
        value = r["features"][feature]
        if value is not None:
            per[r["author"]].append(float(value))
    groups = [np.array(v) for v in per.values() if len(v) >= 2]
    if len(groups) < 2:
        return float("nan")
    n, k = sum(len(g) for g in groups), len(groups)
    grand = np.concatenate(groups).mean()
    between = sum(len(g) * (g.mean() - grand) ** 2 for g in groups)
    within = sum(((g - g.mean()) ** 2).sum() for g in groups)
    if n == k or within == 0:
        return float("nan")
    return float((between / (k - 1)) / (within / (n - k)))


def z_matrix(rows, features):
    """Rows where every named feature applies, z-scored column by column."""
    keep = [r for r in rows if all(r["features"][f] is not None for f in features)]
    if not keep:
        return None, []
    x = np.array([[float(r["features"][f]) for f in features] for r in keep])
    spread = x.std(axis=0)
    spread[spread == 0] = 1.0
    return (x - x.mean(axis=0)) / spread, [r["author"] for r in keep]


def leave_one_out(x, labels, min_files=2):
    """Predict each held-out file from the centroids of the others."""
    labels = np.array(labels)
    counts = Counter(labels)
    usable = [i for i, a in enumerate(labels) if counts[a] >= min_files]
    if len(usable) < 2:
        return float("nan"), 0, 0
    authors = sorted({labels[i] for i in usable})
    correct = 0
    for i in usable:
        centroids = {}
        for a in authors:
            others = [j for j in usable if labels[j] == a and j != i]
            if others:
                centroids[a] = x[others].mean(axis=0)
        best = min(centroids, key=lambda a: np.linalg.norm(x[i] - centroids[a]))
        correct += best == labels[i]
    return correct / len(usable), len(usable), len(authors)


def lift(rows, features, labels=None, min_files=2):
    """Accuracy over chance. Returns nan when the sample is too small."""
    x, author_labels = z_matrix(rows, features)
    if x is None:
        return float("nan"), 0, 0
    acc, n, k = leave_one_out(x, labels if labels is not None else author_labels,
                              min_files)
    return (acc * k if not np.isnan(acc) else float("nan")), n, k


def show(rows, features, label, labels=None, min_files=2, unit="authors"):
    value, n, k = lift(rows, features, labels, min_files)
    if np.isnan(value):
        print(f"  {label:30s} too few files")
        return float("nan")
    print(f"  {label:30s} {value / k:6.1%} vs {1 / k:5.1%} chance = {value:4.2f}x"
          f"   ({n} files, {k} {unit})")
    return value


def eligible_authors(rows, minimum=3):
    return {a for a, c in Counter(r["author"] for r in rows).items() if c >= minimum}


def draws_report(rows, cfg, draws):
    """How much does the answer move when the cap keeps a different sample?

    Every figure above comes from one draw of twelve files per author. Where an
    author has hundreds of eligible files that is one sample out of an enormous
    number, so a figure that moves a lot across draws is not a result. Anything
    whose range crosses 1.0 is indistinguishable from chance.
    """
    collected = defaultdict(list)
    cache = {}
    for seed in range(draws):
        _, _, kept = select(rows, seed=seed)
        measured, _ = measure(kept, cfg, cache)
        applicable = [f for f in FEATURE_NAMES
                      if sum(1 for r in measured if r["features"][f] is not None)
                      >= 0.95 * len(measured)]
        collected["all applicable features"].append(lift(measured, applicable)[0])
        collected["the four scored features"].append(lift(measured, SCORED)[0])
        keep = [r for r in measured
                if all(r["features"][f] is not None for f in applicable)]
        collected["predicting the repository"].append(
            lift(measured, applicable, [r["repo"] for r in keep])[0])
        for repo in sorted({r["repo"] for r in measured}):
            sub = [r for r in measured if r["repo"] == repo]
            keepers = eligible_authors(sub)
            if len(keepers) < 2:
                continue
            value = lift([r for r in sub if r["author"] in keepers], SCORED,
                         min_files=3)[0]
            collected[f"within {repo}, scored four"].append(value)
        for low, high in BANDS:
            band = [r for r in measured if low <= r["lines"] <= high]
            collected[f"band {low}-{high}"].append(lift(band, applicable)[0])

    unbanded = [v for v in collected["all applicable features"] if not np.isnan(v)]
    floor = np.median(unbanded) if unbanded else 1.0
    print(f"  {'quantity':32s} {'median':>8s} {'min':>8s} {'max':>8s}  verdict")
    for name, values in collected.items():
        values = [v for v in values if not np.isnan(v)]
        if not values:
            continue
        low, high = min(values), max(values)
        if name.startswith("band "):
            # a band only earns its place by beating the same features unbanded
            verdict = "beats unbanded" if low > floor else "no better"
        else:
            verdict = "chance" if low <= 1.0 else "holds"
        print(f"  {name:32s} {np.median(values):7.2f}x {low:7.2f}x {high:7.2f}x"
              f"  {verdict}")


MATCH_K = (5, 8, 10, 14, 20)


def matched_report(rows, cfg, draws):
    """Accuracy and lift at a fixed number of authors.

    Lift is accuracy divided by chance, and chance is 1/k, so lift grows with
    the number of authors in the sample even when nothing about the features
    changed. On this data the same Python features score 2.4x over five authors
    and 5.4x over twenty-seven. That makes a bare lift useless for comparing
    one language, or one run, against another: the only comparison that means
    anything holds k fixed. Run both language scripts and read this table.
    """
    cache = {}
    print(f"  {'authors':>8s} {'accuracy':>9s} {'lift':>8s}   draws")
    for k in MATCH_K:
        accs, lifts = [], []
        for seed in range(draws):
            _, _, kept = select(rows, seed=seed)
            measured, _ = measure(kept, cfg, cache)
            applicable = [f for f in FEATURE_NAMES
                          if sum(1 for r in measured if r["features"][f] is not None)
                          >= 0.95 * len(measured)]
            # subsample among authors that are already usable: drop the rows
            # where an applicable feature is missing first, then keep the
            # authors still holding two or more. Sampling before this filter
            # loses most draws, because one short file can push an author under
            # the minimum and the requested k is then never met.
            usable = [r for r in measured
                      if all(r["features"][f] is not None for f in applicable)]
            counts = Counter(r["author"] for r in usable)
            authors = sorted(a for a, c in counts.items() if c >= 2)
            if len(authors) < k:
                continue
            # a fixed seed offset so the author subset is reproducible
            picked = set(random.Random(1000 + seed).sample(authors, k))
            value, _, got = lift([r for r in usable if r["author"] in picked],
                                 applicable)
            if not np.isnan(value) and got == k:
                lifts.append(value)
                accs.append(value / got)
        if not lifts:
            print(f"  {k:8d} {'too few authors in the sample':>30s}")
            continue
        print(f"  {k:8d} {np.median(accs):8.1%} {np.median(lifts):7.2f}x {len(lifts):7d}")


def run(cfg):
    """The whole measurement, identical for every language."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True, help="where the clones live")
    ap.add_argument("--skip-clone", action="store_true")
    ap.add_argument("--save", help="write the measured features to this json file")
    ap.add_argument("--seed", type=int, default=0,
                    help="which sample of files the per-author cap keeps")
    ap.add_argument("--draws", type=int, default=25,
                    help="how many samples to repeat the whole thing on, to "
                         "show how much each figure depends on the sample")
    args = ap.parse_args()

    if not args.skip_clone:
        print("CLONING (full history, single branch)")
        clone_all(cfg, args.work)

    print("\nATTRIBUTING (git blame -w per candidate file)")
    rows = attribute(args.work, cfg)
    single, counts, kept = select(rows, seed=args.seed)
    print(f"  candidates ({MIN_LINES}-{MAX_LINES} lines, no tests) {len(rows):6d}")
    print(f"  one author owns >= {MIN_SHARE:.0%} of lines            {len(single):6d}")
    print(f"  distinct authors after alias merge        {len(counts):6d}")
    print(f"  authors with >= {MIN_FILES_PER_AUTHOR} files                    "
          f"{len({a for a, c in counts.items() if c >= MIN_FILES_PER_AUTHOR}):6d}")
    print(f"  files measured (cap {MAX_FILES_PER_AUTHOR} per author)         {len(kept):6d}")

    print("\nMEASURING with the detector's own extractor")
    measured, failed = measure(kept, cfg)
    print(f"  parsed {len(measured)} of {len(kept)}, {failed} parse failures")
    if args.save:
        json.dump(measured, open(args.save, "w"))

    print("\nHOW OFTEN EACH FEATURE APPLIES")
    for name in FEATURE_NAMES:
        n = sum(1 for r in measured if r["features"][name] is not None)
        print(f"  {name:30s} {n:4d}  {n / len(measured):6.1%}")

    print("\nWITHIN-AUTHOR CV, AND F RATIO")
    print(f"  {'feature':30s} {'cv':>7s} {'F':>7s}")
    ranked = sorted(FEATURE_NAMES, key=lambda f: -(f_ratio(measured, f) or 0))
    for name in ranked:
        print(f"  {name:30s} {within_author_cv(measured, name):7.3f} "
              f"{f_ratio(measured, name):7.2f}")

    applicable = [f for f in FEATURE_NAMES
                  if sum(1 for r in measured if r["features"][f] is not None)
                  >= 0.95 * len(measured)]

    print("\nCLASSIFICATION, ALL FILES")
    show(measured, applicable, "all applicable features")
    show(measured, SCORED, "the four scored features")

    print("\nIS IT THE AUTHOR OR THE REPOSITORY?")
    keep = [r for r in measured
            if all(r["features"][f] is not None for f in applicable)]
    show(measured, applicable, "predicting the repository",
         labels=[r["repo"] for r in keep], unit="repos")

    print("\nAUTHORS WITHIN ONE REPOSITORY (the confound removed)")
    print("  This is the number that matters: Layer 2 always compares a student")
    print("  against their own work inside one course, so project conventions")
    print("  are held constant there in a way they are not across repositories.")
    for repo, _ in Counter(r["repo"] for r in measured).most_common():
        sub = [r for r in measured if r["repo"] == repo]
        keepers = eligible_authors(sub)
        if len(keepers) < 2:
            continue
        show([r for r in sub if r["author"] in keepers], SCORED,
             f"{repo}, scored four", min_files=3)

    print("\nSIZE BANDS (80-250 is the band the day 19 python run derived)")
    for low, high in BANDS:
        band = [r for r in measured if low <= r["lines"] <= high]
        show(band, applicable, f"band {low}-{high}")

    if args.draws > 1:
        print(f"\nHOW MUCH OF THAT IS THE SAMPLE? ({args.draws} draws)")
        draws_report(rows, cfg, args.draws)

        print("\nLIFT AT A FIXED AUTHOR COUNT (the only cross-language comparison)")
        matched_report(rows, cfg, args.draws)
