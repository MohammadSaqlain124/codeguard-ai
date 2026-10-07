"""Does Layer 2 separate authors in Java?

Replicates the Day 19 Python measurement on Java, so the two can be compared:
same ownership threshold, same line bounds, same per-author cap, same
leave-one-out nearest-centroid classifier on z-scored features.

Features come from the real detector, not a replica, so there is nothing that
can disagree with the running service.

Run it from apps/detector:

    python measurements/java_authorship.py --work /tmp/javarepos

Disk: the eleven repositories need full history, because git blame on a
shallow clone attributes every line to the boundary commit. They came to
655 MB in October 2026, so budget about 2 GB and do not start below 5 GB free.
Pass --skip-clone to reuse a work directory you already have.
"""
import argparse
import json
import os
import random
import re
import subprocess
import sys
from collections import Counter, defaultdict

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.features import FEATURE_NAMES, extract_features  # noqa: E402
from app.parsing import parse_source  # noqa: E402

REPOS = [
    "stleary/JSON-java", "google/gson", "jhy/jsoup",
    "brettwooldridge/HikariCP", "apache/commons-lang", "apache/commons-io",
    "apache/commons-csv", "apache/commons-text", "FasterXML/jackson-core",
    "dropwizard/metrics", "zxing/zxing",
]

# Same selection rules as the Python run.
MIN_LINES, MAX_LINES = 30, 700
MIN_SHARE = 0.85
MIN_FILES_PER_AUTHOR = 4
MAX_FILES_PER_AUTHOR = 12

# The four features behavioural.ts actually scores, chosen on the Python data.
SCORED = ("blank_line_ratio", "avg_line_length", "max_block_depth",
          "comment_density")

# 80-250 is the band the python run derived; the others ask whether a band
# suited to java's shorter files does better.
BANDS = ((80, 250), (50, 150), (40, 120), (30, 100))

# One person commits under several names. Each merge below was confirmed by
# reading the commit emails: the 59b500cc suffixes are an SVN to git migration
# artefact from zxing's Google Code history. Without this merge, one author
# looks like three, which moves within-author variance into the between-author
# term and understates every result.
ALIASES = {
    "srowen": "sean owen",
    "srowengmailcom": "sean owen",
    "gary d gregory": "gary gregory",
}

EXCLUDED_DIRS = ("/test/", "/tests/", "/androidtest/", "/generated", "/target/")
EXCLUDED_SUFFIXES = ("Test.java", "Tests.java", "TestCase.java", "IT.java")


def clone_all(work):
    os.makedirs(work, exist_ok=True)
    for slug in REPOS:
        name = slug.split("/")[1]
        dest = os.path.join(work, name)
        if os.path.isdir(dest):
            print(f"  {name:18s} already present")
            continue
        subprocess.run(["git", "clone", "--single-branch", "-q",
                        f"https://github.com/{slug}.git", dest], check=True)
        print(f"  {name:18s} cloned")


def is_excluded(rel):
    clean = posix(rel)
    if any(d in "/" + clean.lower() for d in EXCLUDED_DIRS):
        return True
    # not os.path.basename: that splits on the running platform's separator,
    # so it would return the whole string for a path from the other one
    base = clean.rsplit("/", 1)[-1]
    return base == "package-info.java" or base.endswith(EXCLUDED_SUFFIXES)


def normalise_name(name):
    """Lowercase, strip punctuation, so 'Gary D. Gregory' and 'gary d gregory' match."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", name.lower().strip()))


def attribute(work):
    """Every candidate file with the author who owns most of its surviving lines."""
    rows = []
    for repo in sorted(os.listdir(work)):
        root_dir = os.path.join(work, repo)
        if not os.path.isdir(root_dir):
            continue
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d != ".git"]
            for name in files:
                if not name.endswith(".java"):
                    continue
                path = os.path.join(root, name)
                rel = os.path.relpath(path, root_dir)
                if is_excluded(rel):
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
                        authors[normalise_name(who)] += 1
                if not authors:
                    continue
                top, owned = authors.most_common(1)[0]
                rows.append({
                    "repo": repo, "path": path, "lines": lines,
                    "author": ALIASES.get(top, top),
                    "share": owned / sum(authors.values()),
                })
    return rows


def posix(path):
    """Separator independent path, so the sort below does not depend on the os.

    Windows gives os.walk backslashes and posix gives forward slashes, and the
    two sort differently against the other path characters: "src/main/java/"
    comes before "src/main/java11/" but "src\\main\\java\\" comes after.
    With a cap per author that chooses a different twelve files on each os,
    which is how this was found.

    Replaces the backslash rather than os.sep, because os.sep is itself the
    running platform's separator: using it here would leave a windows path
    untouched on linux, which is the same bug one level up.
    """
    return path.replace("\\", "/")


def select(rows, seed=0):
    """Single-author files, from authors with enough of them, capped per author.

    The cap is the awkward part. Some authors have 230 eligible files and we
    keep twelve, so the choice of twelve is a sample and the result depends on
    it. Taking the alphabetically first twelve is the worst option available:
    nearby paths sit in the same package, and files in one package resemble
    each other more than the author's work in general does. So sort for
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


def measure(rows, cache=None):
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
            parsed = parse_source("java", source)
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


def draws_report(rows, work, draws):
    """How much does the answer move when the cap keeps a different sample?

    Every figure above comes from one draw of twelve files per author. Where an
    author has 230 eligible files that is one sample out of an enormous number,
    so a figure that moves a lot across draws is not a result. Anything whose
    range crosses 1.0 is indistinguishable from chance.
    """
    collected = defaultdict(list)
    cache = {}
    for seed in range(draws):
        _, _, kept = select(rows, seed=seed)
        measured, _ = measure(kept, cache)
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
            eligible = {a for a, c in Counter(r["author"] for r in sub).items()
                        if c >= 3}
            if len(eligible) < 2:
                continue
            value = lift([r for r in sub if r["author"] in eligible], SCORED,
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


def main():
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
        clone_all(args.work)

    print("\nATTRIBUTING (git blame -w per candidate file)")
    rows = attribute(args.work)
    single, counts, kept = select(rows, seed=args.seed)
    print(f"  candidates ({MIN_LINES}-{MAX_LINES} lines, no tests) {len(rows):6d}")
    print(f"  one author owns >= {MIN_SHARE:.0%} of lines            {len(single):6d}")
    print(f"  distinct authors after alias merge        {len(counts):6d}")
    print(f"  authors with >= {MIN_FILES_PER_AUTHOR} files                    "
          f"{len({a for a, c in counts.items() if c >= MIN_FILES_PER_AUTHOR}):6d}")
    print(f"  files measured (cap {MAX_FILES_PER_AUTHOR} per author)         {len(kept):6d}")

    print("\nMEASURING with the detector's own extractor")
    measured, failed = measure(kept)
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
        eligible = {a for a, c in Counter(r["author"] for r in sub).items() if c >= 3}
        if len(eligible) < 2:
            continue
        show([r for r in sub if r["author"] in eligible], SCORED,
             f"{repo}, scored four", min_files=3)

    print("\nSIZE BANDS (the python run derived 80-250 on python files)")
    for low, high in BANDS:
        band = [r for r in measured if low <= r["lines"] <= high]
        show(band, applicable, f"band {low}-{high}")

    if args.draws > 1:
        print(f"\nHOW MUCH OF THAT IS THE SAMPLE? ({args.draws} draws)")
        draws_report(rows, args.work, args.draws)


if __name__ == "__main__":
    main()
