"""
The logistic-regression baseline Layer 3 has to beat, plus a confound control.

Slide 12 said to keep a simple baseline beside CodeBERT rather than instead of
it. This is that baseline: TF-IDF over word and character n-grams into logistic
regression. It trains in seconds on a laptop with no GPU, and if CodeBERT
cannot beat it then CodeBERT is not earning its place in the system.

Two things here matter more than the accuracy number.

GROUPING. Grade 1, 2 and 3 items derived from one AI file are the same program
three times over. Put one in train and another in test and the model is scored
on code it has already seen, which inflates everything. Worse, a grade-3 file
is mostly its human host, so a host sitting in train as "human" and in test
inside a grade-3 item leaks just as badly. This groups every item that shares
an origin or a host and splits whole groups, never items.

THE CONFOUND CONTROL. Grade 2 is built by stripping comments and renaming
identifiers. A classifier can learn "no docstrings, short meaningless names"
and score well without knowing anything about who wrote the code. To measure
that, the control applies the same disguise to HUMAN files and asks the model
to tell disguised human code from plain human code. Both classes are human, so
any separation is pure artifact. Whatever AUC the control reaches is the
ceiling of what grade-2 accuracy is allowed to claim.

    python measurements/baseline_classifier.py --corpus E:\\temp\\ai_corpus
"""

import argparse
import ast
import json
import os
import random
import warnings

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

# Student files sometimes contain things like "\_" inside a string, which is
# an invalid escape sequence. Python only warns, and the file still parses,
# but parsing a hundred of them buries the real output. The warning is about
# the corpus, not about this code, so it is silenced here.
warnings.filterwarnings("ignore", category=SyntaxWarning)

TEST_SHARE = 0.3


def build_model():
    """Word and character n-grams together, into logistic regression."""
    features = FeatureUnion([
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2),
                                 min_df=2, max_features=20000,
                                 token_pattern=r"[A-Za-z_][A-Za-z_0-9]*|[^\sA-Za-z_0-9]")),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4),
                                 min_df=2, max_features=20000)),
    ])
    return Pipeline([
        ("features", features),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
    ])


def has_main_guard(source):
    """True when the file ends with the usual `if __name__ == "__main__"`."""
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return False
    for node in tree.body:
        if isinstance(node, ast.If) and "__name__" in ast.dump(node.test):
            return True
    return False


def strip_main_guard(source):
    """Remove the main-guard block, so the classifier cannot see it."""
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return source
    cuts = []
    for node in tree.body:
        if isinstance(node, ast.If) and "__name__" in ast.dump(node.test):
            cuts.append((node.lineno - 1, getattr(node, "end_lineno", node.lineno) - 1))
    if not cuts:
        return source
    lines = source.split("\n")
    for start, end in sorted(cuts, reverse=True):
        del lines[start:end + 1]
    return "\n".join(lines)


class Groups:
    """Union-find, so items sharing an origin or a host travel together."""

    def __init__(self):
        self.parent = {}

    def find(self, key):
        self.parent.setdefault(key, key)
        while self.parent[key] != key:
            self.parent[key] = self.parent[self.parent[key]]
            key = self.parent[key]
        return key

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def group_items(items):
    """Give every item a group id that no split is allowed to break."""
    groups = Groups()
    for row in items:
        groups.union(("item", row["id"]), ("origin", row["origin"]))
        if row.get("host"):
            groups.union(("origin", row["origin"]), ("origin", row["host"]))
    return [groups.find(("item", row["id"])) for row in items]


def split_by_group(items, group_ids, rng):
    """Hold out whole groups, aiming at TEST_SHARE of the items."""
    by_group = {}
    for row, gid in zip(items, group_ids, strict=True):
        by_group.setdefault(gid, []).append(row)
    order = sorted(by_group)
    rng.shuffle(order)

    target = int(len(items) * TEST_SHARE)
    test_groups, held = set(), 0
    for gid in order:
        if held >= target:
            break
        test_groups.add(gid)
        held += len(by_group[gid])
    train = [r for r, g in zip(items, group_ids, strict=True) if g not in test_groups]
    test = [r for r, g in zip(items, group_ids, strict=True) if g in test_groups]
    return train, test


def roc_auc(scores, labels):
    """AUC by rank, with ties shared. Equivalent to the Mann-Whitney statistic."""
    pairs = sorted(zip(scores, labels, strict=True))
    ranks, i = [0.0] * len(pairs), 0
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]:
            j += 1
        shared = (i + j + 1) / 2
        for k in range(i, j):
            ranks[k] = shared
        i = j
    pos = sum(1 for _, y in pairs if y == 1)
    neg = len(pairs) - pos
    if pos == 0 or neg == 0:
        return float("nan")
    rank_sum = sum(r for r, (_, y) in zip(ranks, pairs, strict=True) if y == 1)
    return (rank_sum - pos * (pos + 1) / 2) / (pos * neg)


def load(corpus):
    with open(os.path.join(corpus, "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    for row in manifest["items"]:
        with open(os.path.join(corpus, row["file"]), encoding="utf-8") as handle:
            row["text"] = handle.read()
    return manifest


def evaluate(train, test, label_name="ai"):
    model = build_model()
    model.fit([r["text"] for r in train], [1 if r["label"] == label_name else 0 for r in train])
    probs = model.predict_proba([r["text"] for r in test])[:, 1]
    truth = [1 if r["label"] == label_name else 0 for r in test]
    return model, probs, truth


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpus", required=True, help="output directory of ai_corpus.py")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--skip-control", action="store_true")
    args = ap.parse_args()
    rng = random.Random(args.seed)

    manifest = load(args.corpus)
    items = manifest["items"]
    group_ids = group_items(items)
    train, test = split_by_group(items, group_ids, rng)

    print(f"{len(items)} items in {len(set(group_ids))} groups")
    print(f"train {len(train)}   test {len(test)}   (whole groups held out)")
    for part, name in ((train, "train"), (test, "test")):
        counts = {}
        for row in part:
            counts[row["grade"]] = counts.get(row["grade"], 0) + 1
        print(f"  {name:6} " + "  ".join(f"{k} {v}" for k, v in sorted(counts.items())))

    if not any(r["label"] == "ai" for r in test) or not any(r["label"] == "human" for r in test):
        raise SystemExit("\nthe held-out set has only one class - raise the corpus size")

    _model, probs, truth = evaluate(train, test)
    print(f"\n{'=' * 70}")
    print("BASELINE, HELD-OUT GROUPS")
    print("=" * 70)
    print(f"  ROC AUC overall           {roc_auc(list(probs), truth):.4f}   (0.5 is chance)")

    # a threshold chosen on train, not on test, or the number is self-flattering
    _m2, tr_probs, tr_truth = evaluate(train, train)
    best, best_t = -1.0, 0.5
    for t in np.linspace(0.05, 0.95, 19):
        pred = [1 if p >= t else 0 for p in tr_probs]
        tp = sum(1 for p, y in zip(pred, tr_truth, strict=True) if p == 1 and y == 1)
        fp = sum(1 for p, y in zip(pred, tr_truth, strict=True) if p == 1 and y == 0)
        fn = sum(1 for p, y in zip(pred, tr_truth, strict=True) if p == 0 and y == 1)
        f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) else 0
        if f1 > best:
            best, best_t = f1, t
    print(f"  threshold from train only {best_t:.2f}")

    human = [(p, r) for p, r in zip(probs, test, strict=True) if r["label"] == "human"]
    if human:
        correct = sum(1 for p, _ in human if p < best_t)
        print(f"  human files kept clean    {correct}/{len(human)} "
              f"({correct / len(human):.1%} specificity)")

    print("\n  recall per AI edit-grade:")
    for grade in ("grade1_raw", "grade2_disguised", "grade3_mixed"):
        rows = [(p, r) for p, r in zip(probs, test, strict=True) if r["grade"] == grade]
        if not rows:
            print(f"    {grade:18} no held-out items")
            continue
        caught = sum(1 for p, _ in rows if p >= best_t)
        print(f"    {grade:18} {caught}/{len(rows)} ({caught / len(rows):.1%})")

    # ---- boilerplate ablation ---------------------------------------------
    # Models end nearly every file with `if __name__ == "__main__":`; students
    # often do not. That one line is a strong separator and a student can
    # delete it in two seconds, so a result resting on it would not survive
    # contact with anyone trying to evade detection. This measures how far the
    # line gets on its own, and what the model scores once it is removed.
    print(f"\n{'=' * 70}")
    print("BOILERPLATE ABLATION - the main guard")
    print("=" * 70)

    guarded = [(1.0 if has_main_guard(r["text"]) else 0.0, r) for r in items]
    share_ai = sum(g for g, r in guarded if r["label"] == "ai") / \
        max(1, sum(1 for _g, r in guarded if r["label"] == "ai"))
    share_human = sum(g for g, r in guarded if r["label"] == "human") / \
        max(1, sum(1 for _g, r in guarded if r["label"] == "human"))
    print(f"  files carrying a main guard:  AI {share_ai:.0%}   human {share_human:.0%}")

    alone = roc_auc([g for g, _r in guarded],
                    [1 if r["label"] == "ai" else 0 for _g, r in guarded])
    print(f"  that one feature on its own:   AUC {alone:.4f}")

    stripped_train = [dict(r, text=strip_main_guard(r["text"])) for r in train]
    stripped_test = [dict(r, text=strip_main_guard(r["text"])) for r in test]
    _m3, sprobs, struth = evaluate(stripped_train, stripped_test)
    stripped_auc = roc_auc(list(sprobs), struth)
    full_auc = roc_auc(list(probs), truth)
    print(f"  full model with it:           AUC {full_auc:.4f}")
    print(f"  full model without it:        AUC {stripped_auc:.4f}   "
          f"({stripped_auc - full_auc:+.4f})")
    print()
    if abs(stripped_auc - full_auc) < 0.02:
        print("  Removing it barely changes the result, so the signal is redundant")
        print("  rather than load-bearing: the headline figure does not rest on this")
        print("  one line. Report both numbers anyway - a reader will ask.")
    else:
        print("  Removing it moves the result materially, so a large part of the")
        print("  headline figure IS this one line. Report the stripped figure as the")
        print("  honest one, because a student who deletes the line defeats the rest.")

    if args.skip_control:
        return

    # ---- the confound control: human vs disguised human -------------------
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from ai_corpus import disguise

    control = []
    for row in items:
        if row["label"] != "human":
            continue
        control.append({"text": row["text"], "label": "human", "grade": "plain",
                        "origin": row["origin"], "id": f"p{row['id']}"})
        hidden = disguise(row["text"], random.Random(args.seed + row["id"]))
        if hidden:
            control.append({"text": hidden, "label": "ai", "grade": "disguised",
                            "origin": row["origin"], "id": f"d{row['id']}"})

    print(f"\n{'=' * 70}")
    print("CONFOUND CONTROL - both classes are human-written")
    print("=" * 70)
    if len({r["origin"] for r in control}) < 4:
        print("  too few human files to run the control")
        return

    cgroups = group_items(control)
    ctrain, ctest = split_by_group(control, cgroups, random.Random(args.seed))
    if any(r["label"] == "ai" for r in ctest) and any(r["label"] == "human" for r in ctest):
        _m, cprobs, ctruth = evaluate(ctrain, ctest)
        auc = roc_auc(list(cprobs), ctruth)
        print(f"  ROC AUC telling disguised human code from plain human code: {auc:.4f}")
        print()
        print("  Both classes here were written by people, so this figure is purely")
        print("  how detectable the grade-2 transformation is on its own.")
        print()
        matched = any(r.get("preprocessing") == "disguised" for r in items
                      if r["label"] == "human")
        if matched:
            print("  The corpus was built with --disguise-human, so disguised files sit")
            print("  in BOTH classes above and the transformation cannot act as a class")
            print("  cue. Do NOT subtract this figure from the grade-2 result: it says")
            print("  why matching was necessary, not how much of the result is an")
            print("  artifact. A high number here with matching in place is expected.")
        else:
            print("  The corpus was built WITHOUT --disguise-human, so the disguise")
            print("  appears in the AI class only and the classifier can win by")
            print("  detecting it. Grade-2 accuracy is inflated by up to this figure")
            print("  and is not reportable. Rebuild with --disguise-human.")
    else:
        print("  the control split landed on one class - raise the corpus size")


if __name__ == "__main__":
    main()
