"""
Fine-tune CodeBERT for Layer 3, with honest evaluation.

WHAT I COULD AND COULD NOT CHECK, stated plainly because it decides how much
to trust this file. The environment I wrote it in has no torch, no
transformers and no GPU, so the training loop in train() has never executed.
What I did verify: the file compiles, it passes the project's ruff
configuration, and every function outside train() - windowing, temperature
scaling, aggregation, metrics - is unit tested in test_train_codebert.py
against numbers worked out by hand. The torch-dependent part is structured to
fail loudly and early on bad input rather than halfway through an epoch.

Expect to fix something the first time you run it. Run it on a small slice
first:

    python ml/train_codebert.py --corpus ai_corpus --limit 40 --epochs 1

Then the real run, on Colab with a GPU:

    python ml/train_codebert.py --corpus ai_corpus --out runs/layer3

DESIGN NOTES

Splits are by group, not by file. Items derived from one source file are the
same program in three disguises, and a grade-3 file is mostly its human host,
so grouping is what keeps the test set honest. The grouping code is imported
from baseline_classifier rather than copied, so the two cannot drift apart.

CodeBERT takes 512 tokens. Most real files are longer, so each file becomes
overlapping windows, every window inherits the file's label, and predictions
are pooled back to one score per file at evaluation. Scoring windows and
reporting that as accuracy would quietly measure something else.

The reported probability is temperature scaled on the validation split. A
fine-tuned transformer is badly overconfident out of the box, and this feeds a
system whose whole claim is that a score is evidence rather than a verdict. An
uncalibrated 0.99 would make that claim dishonest.

Accuracy is reported per edit-grade and next to the logistic baseline. If
CodeBERT does not beat the baseline, say so in the report; that is a finding,
not a failure.
"""

import argparse
import json
import math
import os

from baseline_classifier import group_items, roc_auc

DEFAULT_MODEL = "microsoft/codebert-base"
MAX_TOKENS = 512
WINDOW_STRIDE = 256


def windows(token_ids, max_tokens=MAX_TOKENS, stride=WINDOW_STRIDE):
    """
    Overlapping windows of token ids, each at most max_tokens long.

    Two special positions are reserved per window for the start and end
    markers the tokenizer adds, so the caller never has to remember to.
    """
    if max_tokens <= 2:
        raise ValueError("max_tokens must leave room for the two special tokens")
    body = max_tokens - 2
    if stride <= 0 or stride > body:
        raise ValueError("stride must be positive and no larger than the window body")
    if not token_ids:
        return [[]]
    out = []
    start = 0
    while True:
        out.append(token_ids[start:start + body])
        if start + body >= len(token_ids):
            break
        start += stride
    return out


def pool(scores, how="max"):
    """
    One score per file from its windows' scores.

    "max" is the default and the right one here: a file is outsourced if ANY
    substantial part of it is, which is exactly the partial case grade 3 is
    built to test. A mean would dilute one AI function across a long human
    file and report a miss the design never intended.
    """
    if not scores:
        return float("nan")
    if how == "max":
        return max(scores)
    if how == "mean":
        return sum(scores) / len(scores)
    raise ValueError(f"unknown pooling: {how}")


def fit_temperature(logit_gaps, labels, grid=None):
    """
    Find the temperature that best calibrates the scores, on validation data.

    logit_gaps are (logit_ai - logit_human). Dividing by T > 1 softens
    confidence, T < 1 sharpens it. Chosen by minimising negative log
    likelihood over a grid, which needs no autograd and cannot diverge.
    """
    if not logit_gaps:
        return 1.0
    if grid is None:
        grid = [0.25 + 0.05 * i for i in range(96)]
    best_t, best_nll = 1.0, float("inf")
    for temperature in grid:
        nll = 0.0
        for gap, label in zip(logit_gaps, labels, strict=True):
            z = gap / temperature
            # log(1 + exp(-|z|)) is the stable form; the sign term handles the label
            nll += math.log1p(math.exp(-abs(z))) + max(0.0, -z if label == 1 else z)
        if nll < best_nll:
            best_t, best_nll = temperature, nll
    return best_t


def apply_temperature(logit_gap, temperature):
    """Probability of the AI class after scaling."""
    z = logit_gap / temperature
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    return math.exp(z) / (1.0 + math.exp(z))


def expected_calibration_error(probs, labels, bins=10):
    """
    How far predicted confidence sits from observed frequency.

    Reported because the system presents scores to a human reviewer. A model
    that says 0.9 should be right about 90% of the time, and if it is not, the
    evidence page is misleading whoever reads it.
    """
    if not probs:
        return float("nan")
    total = 0.0
    for b in range(bins):
        low, high = b / bins, (b + 1) / bins
        chosen = [(p, y) for p, y in zip(probs, labels, strict=True)
                  if (p > low or (b == 0 and p >= low)) and p <= high]
        if not chosen:
            continue
        confidence = sum(p for p, _ in chosen) / len(chosen)
        accuracy = sum(y for _, y in chosen) / len(chosen)
        total += len(chosen) / len(probs) * abs(confidence - accuracy)
    return total


def load_corpus(corpus, limit=0):
    with open(os.path.join(corpus, "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    items = manifest["items"]
    if limit:
        items = items[:limit]
    for row in items:
        with open(os.path.join(corpus, row["file"]), encoding="utf-8") as handle:
            row["text"] = handle.read()
    return items


def three_way_split(items, seed):
    """Train, validation and test, splitting whole groups."""
    import random

    group_ids = group_items(items)
    by_group = {}
    for row, gid in zip(items, group_ids, strict=True):
        by_group.setdefault(gid, []).append(row)
    order = sorted(by_group)
    random.Random(seed).shuffle(order)

    n = len(items)
    test, val, train = [], [], []
    for gid in order:
        rows = by_group[gid]
        if len(test) < 0.2 * n:
            test.extend(rows)
        elif len(val) < 0.15 * n:
            val.extend(rows)
        else:
            train.extend(rows)
    return train, val, test


def check_splits(train, val, test):
    """Refuse to train on a split that cannot produce a meaningful number."""
    problems = []
    for part, name in ((train, "train"), (val, "val"), (test, "test")):
        if not part:
            problems.append(f"{name} split is empty")
            continue
        labels = {row["label"] for row in part}
        if len(labels) < 2:
            problems.append(f"{name} split holds only the {labels.pop()} class")
    origins = {}
    for part, name in ((train, "train"), (val, "val"), (test, "test")):
        for row in part:
            origins.setdefault(row["origin"], set()).add(name)
        for row in part:
            if row.get("host"):
                origins.setdefault(row["host"], set()).add(name)
    straddling = [o for o, parts in origins.items() if len(parts) > 1]
    if straddling:
        problems.append(f"{len(straddling)} source files appear in more than one "
                        f"split, so the test score would be inflated")
    return problems


def train(args):
    """The torch half. Never executed in the environment this was written in."""
    import numpy as np
    import torch
    from torch.utils.data import DataLoader, TensorDataset
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    items = load_corpus(args.corpus, args.limit)
    parts = three_way_split(items, args.seed)
    problems = check_splits(*parts)
    if problems:
        for problem in problems:
            print("SPLIT PROBLEM:", problem)
        raise SystemExit("refusing to train - fix the corpus or raise its size")
    train_rows, val_rows, test_rows = parts
    print(f"train {len(train_rows)}  val {len(val_rows)}  test {len(test_rows)}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("WARNING: no GPU found. This will take hours. Use Colab with a T4.")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model, num_labels=2).to(device)

    def encode(rows):
        ids, masks, labels, owners = [], [], [], []
        for index, row in enumerate(rows):
            body = tokenizer(row["text"], add_special_tokens=False)["input_ids"]
            for window in windows(body, MAX_TOKENS, WINDOW_STRIDE):
                built = tokenizer.prepare_for_model(
                    window, max_length=MAX_TOKENS, padding="max_length",
                    truncation=True)
                ids.append(built["input_ids"])
                masks.append(built["attention_mask"])
                labels.append(1 if row["label"] == "ai" else 0)
                owners.append(index)
        return (TensorDataset(torch.tensor(ids), torch.tensor(masks),
                              torch.tensor(labels)), owners)

    train_set, _ = encode(train_rows)
    val_set, val_owners = encode(val_rows)
    test_set, test_owners = encode(test_rows)
    print(f"windows: train {len(train_set)}  val {len(val_set)}  test {len(test_set)}")

    loader = DataLoader(train_set, batch_size=args.batch, shuffle=True)
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr)
    for epoch in range(args.epochs):
        model.train()
        running = 0.0
        for step, (ids, mask, label) in enumerate(loader, 1):
            optimiser.zero_grad()
            out = model(input_ids=ids.to(device), attention_mask=mask.to(device),
                        labels=label.to(device))
            out.loss.backward()
            optimiser.step()
            running += out.loss.item()
            if step % 20 == 0:
                print(f"  epoch {epoch + 1} step {step}/{len(loader)} "
                      f"loss {running / step:.4f}")
        print(f"epoch {epoch + 1} mean loss {running / max(1, len(loader)):.4f}")

    def logit_gaps(dataset):
        model.eval()
        gaps = []
        with torch.no_grad():
            for ids, mask, _label in DataLoader(dataset, batch_size=args.batch):
                out = model(input_ids=ids.to(device), attention_mask=mask.to(device))
                logits = out.logits.detach().cpu().numpy()
                gaps.extend((logits[:, 1] - logits[:, 0]).tolist())
        return gaps

    val_gaps = logit_gaps(val_set)
    val_file_gaps, val_labels = [], []
    for index, row in enumerate(val_rows):
        mine = [g for g, owner in zip(val_gaps, val_owners, strict=True) if owner == index]
        if mine:
            val_file_gaps.append(pool(mine, args.pooling))
            val_labels.append(1 if row["label"] == "ai" else 0)
    temperature = fit_temperature(val_file_gaps, val_labels)
    print(f"\ntemperature fitted on validation: {temperature:.2f}")

    test_gaps = logit_gaps(test_set)
    results = []
    for index, row in enumerate(test_rows):
        mine = [g for g, owner in zip(test_gaps, test_owners, strict=True) if owner == index]
        if not mine:
            continue
        gap = pool(mine, args.pooling)
        results.append({"file": row["file"], "grade": row["grade"],
                        "label": row["label"], "windows": len(mine),
                        "prob_ai": apply_temperature(gap, temperature),
                        "prob_ai_uncalibrated": apply_temperature(gap, 1.0)})

    probs = [r["prob_ai"] for r in results]
    truth = [1 if r["label"] == "ai" else 0 for r in results]

    print(f"\n{'=' * 70}")
    print("CODEBERT, HELD-OUT GROUPS")
    print("=" * 70)
    print(f"  ROC AUC                 {roc_auc(probs, truth):.4f}  (0.5 is chance)")
    print(f"  calibration error       {expected_calibration_error(probs, truth):.4f}")
    print(f"  uncalibrated            "
          f"{expected_calibration_error([r['prob_ai_uncalibrated'] for r in results], truth):.4f}")
    print("\n  recall per AI edit-grade, at 0.5:")
    for grade in ("grade1_raw", "grade2_disguised", "grade3_mixed"):
        rows = [r for r in results if r["grade"] == grade]
        if not rows:
            print(f"    {grade:18} no held-out items")
            continue
        caught = sum(1 for r in rows if r["prob_ai"] >= 0.5)
        print(f"    {grade:18} {caught}/{len(rows)} ({caught / len(rows):.1%})")
    clean = [r for r in results if r["label"] == "human"]
    if clean:
        kept = sum(1 for r in clean if r["prob_ai"] < 0.5)
        print(f"  human files kept clean  {kept}/{len(clean)} ({kept / len(clean):.1%})")

    print("\n  Compare these against baseline_classifier.py on the same corpus.")
    print("  If CodeBERT does not beat it, that belongs in the report as a")
    print("  finding about the problem, not as a defect to hide.")

    os.makedirs(args.out, exist_ok=True)
    payload = {"model": args.model, "epochs": args.epochs, "lr": args.lr,
               "pooling": args.pooling, "temperature": temperature,
               "seed": args.seed, "max_tokens": MAX_TOKENS,
               "stride": WINDOW_STRIDE, "n_test_files": len(results),
               "roc_auc": roc_auc(probs, truth),
               "calibration_error": expected_calibration_error(probs, truth),
               "per_file": results}
    with open(os.path.join(args.out, "metrics.json"), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    model.save_pretrained(os.path.join(args.out, "model"))
    tokenizer.save_pretrained(os.path.join(args.out, "model"))
    print(f"\nwritten to {args.out}")
    _ = np  # numpy is imported for the environments where torch needs it present


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpus", required=True, help="output directory of ai_corpus.py")
    ap.add_argument("--out", default="runs/layer3")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--pooling", default="max", choices=("max", "mean"))
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--limit", type=int, default=0,
                    help="use only the first N items, for a quick smoke run")
    args = ap.parse_args()
    train(args)


if __name__ == "__main__":
    main()
