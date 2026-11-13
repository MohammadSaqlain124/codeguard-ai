"""
Build the labelled human-vs-AI corpus Layer 3 needs, in three edit grades.

Slide 12 of the proposal promised accuracy reported per AI edit-grade, because
the drop-off across grades is the interesting result: a classifier that spots
raw ChatGPT output and nothing else is of no use against a student who renames
things. This builds those grades.

    grade 1  raw          the model's output, untouched
    grade 2  disguised    identifiers renamed, comments and docstrings stripped
    grade 3  mixed        one AI function spliced into an otherwise human file

You supply two directories. Everything else is derived.

    --human   real human-written .py files. Use code that predates widespread
              LLM code generation, or your own attributed corpus. These are the
              negative class AND the hosts for grade 3.
    --ai      raw model-generated .py files, one solution per file. Prompt for
              the same kinds of task the human files perform.

Deliberately built on the standard library only - ast and tokenize - so it
needs no tree-sitter, no detector package, and runs anywhere Python runs.
Python only; the grade transformations are language-specific and Java would
need its own.

    python measurements/ai_corpus.py --human E:\\temp\\human --ai E:\\temp\\ai \\
        --out E:\\temp\\ai_corpus

A note on honesty, because it decides whether the result is reportable: the
human class must be genuinely human. Files written after 2023, or anything you
cannot vouch for, contaminate the negative class and inflate every number that
follows. Record where the human files came from in the manifest's provenance
field and say it in the report.
"""

import argparse
import ast
import builtins
import io
import json
import os
import random
import tokenize

# A file shorter than this carries too little style to classify, and one
# longer than this is usually generated boilerplate or a vendored blob.
MIN_LINES = 25
MAX_LINES = 600

# Grade 3 splices one AI function into a human file. Below this many top-level
# functions the host has nothing to give up without becoming mostly AI.
MIN_HOST_FUNCTIONS = 3

# How many host/donor pairs to try before giving up on one AI file.
HOST_ATTEMPTS = 25

# A grade-3 file this little of which is AI is not a fair test item. The
# style-shift corpus used fractions of 0.10, 0.25 and 0.50, so matching its
# floor keeps the two sets of results comparable. Without a floor the first
# run of this builder produced a median AI share of 0.038, which no detector
# could be expected to catch and which would read as a failure it had not
# earned.
MIN_AI_SHARE = 0.10


def read(path):
    try:
        with open(path, "rb") as handle:
            return handle.read().decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def usable(source):
    """Parses, and is neither trivially short nor suspiciously long."""
    if source is None:
        return False
    lines = source.count("\n") + 1
    if lines < MIN_LINES or lines > MAX_LINES:
        return False
    try:
        ast.parse(source)
    except (SyntaxError, ValueError, RecursionError):
        return False
    return True


def collect(root):
    out = []
    for folder, _dirs, files in os.walk(root):
        for name in sorted(files):
            if not name.endswith(".py"):
                continue
            path = os.path.join(folder, name)
            source = read(path)
            if usable(source):
                out.append((path, source))
    return out


def collapse_blank_lines(text):
    """Squeeze the runs of blank lines that removal leaves behind."""
    cleaned, blank = [], 0
    for line in text.split("\n"):
        line = line.rstrip()
        if line == "":
            blank += 1
            if blank > 1:
                continue
        else:
            blank = 0
        cleaned.append(line)
    return "\n".join(cleaned)


def strip_docstrings(source):
    """
    Remove module, class and function docstrings.

    Done with ast rather than tokenize, because ast is the only thing that
    actually knows a string is a docstring: position in the token stream does
    not tell you, and a bare string used as a statement elsewhere in the body
    is not one.
    """
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return None

    holders = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
    edits = []
    for node in ast.walk(tree):
        if not isinstance(node, holders) or not node.body:
            continue
        first = node.body[0]
        if not (isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant)
                and isinstance(first.value.value, str)):
            continue
        end = getattr(first, "end_lineno", None)
        if end is None:
            continue
        # a body that is nothing but its docstring needs a pass to stay legal
        if len(node.body) == 1 and not isinstance(node, ast.Module):
            replacement = [" " * first.col_offset + "pass"]
        else:
            replacement = []
        edits.append((first.lineno - 1, end - 1, replacement))

    lines = source.split("\n")
    # apply bottom-up so earlier line numbers stay valid
    for start, end, replacement in sorted(edits, key=lambda e: -e[0]):
        lines[start:end + 1] = replacement

    out = "\n".join(lines)
    try:
        ast.parse(out)
    except (SyntaxError, ValueError, IndentationError):
        return None
    return out


def strip_comments(source):
    """
    Remove comments using tokenize, which understands string literals.

    A regex cannot do this: a '#' inside a string is not a comment, and getting
    that wrong silently corrupts the file. A comment always runs to the end of
    its line, so truncating the line at the token's start column is exact.
    """
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return None

    lines = source.split("\n")
    for kind, _text, (srow, scol), _end, _raw in tokens:
        if kind == tokenize.COMMENT:
            lines[srow - 1] = lines[srow - 1][:scol].rstrip()

    out = "\n".join(lines)
    try:
        ast.parse(out)
    except (SyntaxError, ValueError, IndentationError):
        return None
    return out


def disguise(source, rng):
    """Grade 2: strip the prose, then rename the names."""
    stage = strip_docstrings(source)
    if stage is None:
        return None
    stage = strip_comments(stage)
    if stage is None:
        return None
    stage = rename_identifiers(stage, rng)
    if stage is None:
        return None
    return collapse_blank_lines(stage)


def rename_identifiers(source, rng):
    """
    Rename local names to neutral ones, the way a student covering their
    tracks would. Uses ast to find the names, so keywords, attributes and
    imported names are left alone.
    """
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return None

    # dir(builtins), not dir(__builtins__). The latter is a module when this
    # file is run directly but a dict when it is imported, so it would return
    # dict methods instead of the builtin names and let print, range and round
    # be renamed. That failure is invisible until the renamed file is executed.
    protected = set(dir(builtins)) | {"self", "cls", "__init__", "__name__", "__main__"}
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            # Every component of a dotted path, not just the bound name. A file
            # with a variable called "pager" would otherwise turn
            # "from _pyrepl.pager import get_pager" into "from _pyrepl.v4
            # import get_pager", which fails only on import.
            for part in (getattr(node, "module", None) or "").split("."):
                if part:
                    protected.add(part)
            for alias in node.names:
                for part in alias.name.split("."):
                    protected.add(part)
                if alias.asname:
                    protected.add(alias.asname)
        if isinstance(node, ast.Attribute):
            protected.add(node.attr)
        # A keyword at a call site has to keep matching the callee's parameter
        # name, and the callee is often in another file or in the standard
        # library. Renaming open(..., encoding=...) to open(..., v3=...) fails
        # only when the file is run, which is far too late to notice.
        if isinstance(node, ast.keyword) and node.arg:
            protected.add(node.arg)
        # Names inside an f-string are left alone on every Python version.
        # Before 3.12 the tokenizer reports an f-string as a single STRING
        # token, so a name inside it is never seen as a NAME and never
        # renamed, while its definition elsewhere in the file is. The file
        # still parses and fails only when run. Protecting these names keeps
        # the result identical on 3.11 and on 3.13.
        if isinstance(node, ast.JoinedStr):
            for inner in ast.walk(node):
                if isinstance(inner, ast.Name):
                    protected.add(inner.id)
                elif isinstance(inner, ast.Attribute):
                    protected.add(inner.attr)

    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id not in protected:
            names.add(node.id)
        elif isinstance(node, ast.arg) and node.arg not in protected:
            names.add(node.arg)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) \
                and node.name not in protected:
            names.add(node.name)

    # Pick a prefix no name in the file already uses, so a generated name can
    # never collide with a protected one the file keeps.
    everything = names | protected
    prefix = "v"
    while any(n.startswith(prefix) and n[len(prefix):].isdigit() for n in everything):
        prefix += "x"

    ordered = sorted(names)
    rng.shuffle(ordered)
    mapping = {n: f"{prefix}{i}" for i, n in enumerate(ordered)}

    # Substitute in place, by line and column. Reassembling the file from the
    # token stream instead doubles every line break, because the row-advance
    # and the NEWLINE token's own text both contribute one, and the extra
    # blank lines would change the blank-line ratio - one of the four features
    # Layer 2 scores - making grade 2 separable on whitespace alone.
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return None

    # a name never spans lines, so group the edits per line
    per_line = {}
    for kind, text, (srow, scol), (_erow, ecol), _raw in tokens:
        if kind == tokenize.NAME and text in mapping:
            per_line.setdefault(srow, []).append((scol, ecol, mapping[text]))

    lines = source.split("\n")
    for row, edits in per_line.items():
        line = lines[row - 1]
        # right to left, so earlier columns stay valid
        for scol, ecol, replacement in sorted(edits, reverse=True):
            line = line[:scol] + replacement + line[ecol:]
        lines[row - 1] = line

    out = "\n".join(lines)
    try:
        ast.parse(out)
    except (SyntaxError, ValueError, IndentationError):
        return None
    return out


def top_level_functions(source):
    """(name, start, end) line numbers for each top-level def, 1-indexed."""
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return []
    out = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            end = getattr(node, "end_lineno", None)
            if end:
                out.append((node.name, node.lineno, end))
    return out


def splice(host, donor, rng):
    """Replace one of the host's top-level functions with one of the donor's."""
    host_fns = top_level_functions(host)
    donor_fns = top_level_functions(donor)
    if len(host_fns) < MIN_HOST_FUNCTIONS or not donor_fns:
        return None

    _, h_start, h_end = rng.choice(host_fns)
    _, d_start, d_end = rng.choice(donor_fns)
    host_lines = host.split("\n")
    donor_lines = donor.split("\n")
    merged = host_lines[:h_start - 1] + donor_lines[d_start - 1:d_end] + host_lines[h_end:]
    out = "\n".join(merged)
    try:
        ast.parse(out)
    except (SyntaxError, ValueError, IndentationError):
        return None
    replaced = h_end - h_start + 1
    inserted = d_end - d_start + 1
    return out, inserted / max(1, len(merged)), replaced


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--human", required=True, help="directory of human .py files")
    ap.add_argument("--ai", required=True, help="directory of raw model-written .py files")
    ap.add_argument("--out", required=True, help="where to write the corpus")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--disguise-human", action="store_true",
                    help="also emit a comment-stripped, renamed copy of each human "
                         "file, still labelled human, so the classifier cannot win "
                         "by spotting the disguise instead of the author. Strongly "
                         "recommended - without it grade-2 accuracy is an artifact.")
    ap.add_argument("--provenance", default="",
                    help="where the human files came from - recorded in the manifest")
    args = ap.parse_args()
    rng = random.Random(args.seed)

    human = collect(args.human)
    ai = collect(args.ai)
    print(f"human files usable: {len(human)}")
    print(f"ai    files usable: {len(ai)}")
    if not human or not ai:
        raise SystemExit("need files in both directories")
    if len(ai) < 30 or len(human) < 30:
        print("\nWARNING: fewer than 30 files in a class. Any accuracy figure from")
        print("a corpus this small is noise. Treat it as a smoke test, not a result.")

    os.makedirs(args.out, exist_ok=True)
    items, counts = [], {"human": 0, "grade1_raw": 0, "grade2_disguised": 0, "grade3_mixed": 0}
    skipped = {"grade2": 0, "grade3": 0}

    def emit(source, label, grade, origin, extra=None):
        idx = len(items) + 1
        name = f"{idx:05d}-{grade}.py"
        with open(os.path.join(args.out, name), "w", encoding="utf-8") as handle:
            handle.write(source)
        row = {"id": idx, "file": name, "label": label, "grade": grade, "origin": origin,
               "lines": source.count("\n") + 1}
        if extra:
            row.update(extra)
        items.append(row)
        counts[grade if label == "ai" else "human"] += 1

    for path, source in human:
        emit(source, "human", "human", path)
        # Matched preprocessing. Grade 2 strips comments and renames
        # identifiers, and a classifier will happily learn that instead of
        # learning authorship: the control in baseline_classifier.py separates
        # disguised human code from plain human code at AUC 1.0000. Putting
        # disguised copies in the human class too removes the shortcut, so a
        # grade-2 result means something.
        if args.disguise_human:
            hidden = disguise(source, rng)
            if hidden:
                emit(hidden, "human", "human", path, {"preprocessing": "disguised"})

    # Only files with enough top-level functions can host a splice. Filtering
    # once beats picking blindly and losing most attempts: a blind pick failed
    # 57% of the time on the first corpus this was run against.
    hosts = [(p, s) for p, s in human if len(top_level_functions(s)) >= MIN_HOST_FUNCTIONS]
    print(f"eligible grade-3 hosts: {len(hosts)} of {len(human)} human files")
    if not hosts:
        print("WARNING: no human file has enough top-level functions to host a")
        print("splice, so grade 3 will be empty. Add longer, function-based files.")

    for path, source in ai:
        emit(source, "ai", "grade1_raw", path)

        disguised = disguise(source, rng)
        if disguised:
            emit(disguised, "ai", "grade2_disguised", path)
        else:
            skipped["grade2"] += 1

        # several attempts, because a pair can fail to parse or produce an AI
        # share too small to be a fair test
        placed = False
        for _attempt in range(HOST_ATTEMPTS):
            if not hosts:
                break
            host_path, host_src = rng.choice(hosts)
            mixed = splice(host_src, source, rng)
            if mixed is None:
                continue
            text, share, replaced = mixed
            if share < MIN_AI_SHARE:
                continue
            emit(text, "ai", "grade3_mixed", path,
                 {"host": host_path, "ai_share": round(share, 4),
                  "replaced_lines": replaced})
            placed = True
            break
        if not placed:
            skipped["grade3"] += 1

    shares = sorted(r["ai_share"] for r in items if r["grade"] == "grade3_mixed")
    manifest = {
        "seed": args.seed,
        "provenance_human": args.provenance,
        "counts": counts,
        "skipped": skipped,
        "min_ai_share": MIN_AI_SHARE,
        "grade3_ai_share": {
            "min": shares[0] if shares else None,
            "median": shares[len(shares) // 2] if shares else None,
            "max": shares[-1] if shares else None,
        },
        "note": ("grade3_mixed files are mostly human. A classifier that calls them "
                 "AI on the strength of one function is doing the right thing; one "
                 "that calls them human is failing the case that matters most."),
        "items": items,
    }
    with open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"\nwritten to {args.out}")
    for k, v in counts.items():
        print(f"  {k:18} {v}")
    print(f"  skipped: grade2 {skipped['grade2']}, grade3 {skipped['grade3']}")
    if shares:
        print(f"  grade3 AI share: min {shares[0]:.3f} "
              f"median {shares[len(shares) // 2]:.3f} max {shares[-1]:.3f}")
    if not args.provenance:
        print("\nNOTE: --provenance was empty. Record where the human files came from")
        print("before any number from this corpus goes in the report.")


if __name__ == "__main__":
    main()
