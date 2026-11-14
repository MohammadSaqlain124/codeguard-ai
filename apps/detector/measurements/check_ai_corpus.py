"""
Check the AI class against the prompt sheet before building the corpus.

Models do not reliably follow a style instruction. Asked for no comments they
often add them anyway, and asked for no docstrings they often write one for
every function. Those four traits - module docstring, function docstrings,
type hints, comments - are exactly what a classifier will latch onto if they
end up correlated with the class, so a file that ignored its STYLE line is a
file that quietly biases the result.

This reads AI_CORPUS_PROMPTS.md, compares every generated file against what
its prompt asked for, and reports the gaps.

    python measurements/check_ai_corpus.py --dir E:\\temp\\ai
    python measurements/check_ai_corpus.py --dir E:\\temp\\ai --fix

--fix only ever REMOVES: comments and docstrings that should not be there. It
never adds anything, because a docstring this script invents is not model
output and would corrupt the very thing being measured. Anything that needs
adding is listed for you to regenerate.
"""

import argparse
import ast
import io
import os
import re
import sys
import tokenize

MIN_LINES = 25
MAX_LINES = 600

TRAITS = ("module docstring", "function docstrings", "type hints", "comments")


def read_sheet(path):
    """Map prompt number to the set of traits its STYLE line asked for."""
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    blocks = re.findall(
        r"\*\*(\d+)\.\*\* (.+?)\n\s+- MODEL: (.+?)\n\s+- STYLE: (.+?)\n", text)
    wanted = {}
    for number, _task, model, style in blocks:
        if "no docstrings" in style:
            traits = set()
        else:
            traits = {t for t in TRAITS if t in style}
        wanted[int(number)] = (traits, model)
    return wanted


def observe(source):
    """Which of the four traits a file actually has."""
    tree = ast.parse(source)
    has = set()
    if ast.get_docstring(tree):
        has.add("module docstring")
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if ast.get_docstring(node):
                has.add("function docstrings")
            if node.returns or any(a.annotation for a in node.args.args):
                has.add("type hints")
        if isinstance(node, ast.AnnAssign):
            has.add("type hints")
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type == tokenize.COMMENT:
            has.add("comments")
            break
    return has


def squeeze_blanks(text):
    """Collapse the runs of blank lines a removal leaves behind."""
    out, blank = [], 0
    for line in text.split("\n"):
        line = line.rstrip()
        if not line:
            blank += 1
            if blank > 1:
                continue
        else:
            blank = 0
        out.append(line)
    return "\n".join(out)


def strip_comments(source):
    """Drop comments. A comment runs to end of line, so truncating is exact."""
    lines = source.split("\n")
    for kind, _text, (row, col), _end, _raw in tokenize.generate_tokens(
            io.StringIO(source).readline):
        if kind == tokenize.COMMENT:
            lines[row - 1] = lines[row - 1][:col].rstrip()
    return squeeze_blanks("\n".join(lines))


def strip_docstrings(source, module_level, function_level):
    """Remove docstrings at the requested levels, keeping the file legal."""
    tree = ast.parse(source)
    holders = []
    if module_level:
        holders.append(ast.Module)
    if function_level:
        holders.extend([ast.FunctionDef, ast.AsyncFunctionDef])
    if not holders:
        return source

    edits = []
    for node in ast.walk(tree):
        if not isinstance(node, tuple(holders)) or not node.body:
            continue
        first = node.body[0]
        if not (isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant)
                and isinstance(first.value.value, str)):
            continue
        end = getattr(first, "end_lineno", None)
        if end is None:
            continue
        # a body that is only its docstring needs a pass to stay valid
        if len(node.body) == 1 and not isinstance(node, ast.Module):
            replacement = [" " * first.col_offset + "pass"]
        else:
            replacement = []
        edits.append((first.lineno - 1, end - 1, replacement))

    lines = source.split("\n")
    for start, end, replacement in sorted(edits, key=lambda e: -e[0]):
        lines[start:end + 1] = replacement
    return squeeze_blanks("\n".join(lines))


def repair(source, extra):
    """Remove the traits the file has but should not. Returns None if stuck."""
    out = source
    if "comments" in extra:
        out = strip_comments(out)
    if "module docstring" in extra or "function docstrings" in extra:
        out = strip_docstrings(out, "module docstring" in extra,
                               "function docstrings" in extra)
    try:
        ast.parse(out)
    except (SyntaxError, ValueError, IndentationError):
        return None
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", required=True, help="folder holding the generated .py files")
    ap.add_argument("--sheet", default=os.path.join(here, "AI_CORPUS_PROMPTS.md"))
    ap.add_argument("--fix", action="store_true",
                    help="strip comments and docstrings that should not be there")
    args = ap.parse_args()

    wanted = read_sheet(args.sheet)
    print(f"{len(wanted)} prompts in the sheet, checking {args.dir}\n")

    missing, broken, sized, mismatched, fixed, clean = [], [], [], [], [], []

    for number in sorted(wanted):
        traits, model = wanted[number]
        path = os.path.join(args.dir, f"{number:03d}.py")
        if not os.path.exists(path):
            missing.append((number, model))
            continue

        with open(path, encoding="utf-8") as handle:
            source = handle.read()

        try:
            found = observe(source)
        except (SyntaxError, ValueError, tokenize.TokenError, IndentationError) as error:
            broken.append((number, type(error).__name__))
            continue

        count = source.count("\n") + 1
        if not MIN_LINES <= count <= MAX_LINES:
            sized.append((number, count))
            continue

        extra = found - traits
        absent = traits - found

        if not extra and not absent:
            clean.append(number)
            continue

        if args.fix and extra and not absent:
            repaired = repair(source, extra)
            if repaired is not None and observe(repaired) == traits:
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write(repaired)
                fixed.append(number)
                continue

        mismatched.append((number, sorted(extra), sorted(absent)))

    print(f"clean            {len(clean)}")
    if fixed:
        names = ", ".join(f"{n:03d}" for n in fixed)
        print(f"fixed in place   {len(fixed)}  -> {names}")
    print(f"needs attention  {len(mismatched) + len(broken) + len(sized)}")
    print(f"not generated    {len(missing)}")

    if missing:
        print("\nnot generated yet:")
        for number, model in missing:
            print(f"  {number:03d}.py   (sheet says use {model})")

    if broken:
        print("\nwill not parse - regenerate these:")
        for number, kind in broken:
            print(f"  {number:03d}.py   {kind}")

    if sized:
        print(f"\noutside the {MIN_LINES}-{MAX_LINES} line window - regenerate:")
        for number, count in sized:
            print(f"  {number:03d}.py   {count} lines")

    if mismatched:
        print("\nstyle does not match the prompt:")
        for number, extra, absent in mismatched:
            parts = []
            if extra:
                parts.append("has but should not: " + ", ".join(extra))
            if absent:
                parts.append("missing: " + ", ".join(absent))
            print(f"  {number:03d}.py   {' | '.join(parts)}")
        if not args.fix and any(extra and not absent for _n, extra, absent in mismatched):
            print("\n  re-run with --fix to strip the 'has but should not' cases")
        if any(absent for _n, _e, absent in mismatched):
            print("\n  'missing' cases cannot be fixed here. Ask the model again with the")
            print("  style sentence repeated, or accept them and note it in the report -")
            print("  do not write the docstrings yourself, they would not be model output.")

    total_ready = len(clean) + len(fixed)
    print(f"\n{total_ready}/{len(wanted)} files ready for ai_corpus.py")
    return 0 if total_ready == len(wanted) else 1


if __name__ == "__main__":
    sys.exit(main())
