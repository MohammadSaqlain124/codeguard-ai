"""
Prove that grade 2 changes only names and prose, never structure.

Blanks every identifier in both versions and compares the resulting ASTs. If
the shapes match, the disguise renamed and stripped without altering what the
program does.
"""
import ast
import glob
import random
import sys

sys.path.insert(0, ".")
from ai_corpus import disguise


class Blank(ast.NodeTransformer):
    def visit_Name(self, n):
        n.id = "_"
        return n

    def visit_arg(self, n):
        n.arg = "_"
        n.annotation = None
        return self.generic_visit(n)

    def visit_FunctionDef(self, n):
        n.name = "_"
        return self.generic_visit(n)

    def visit_AsyncFunctionDef(self, n):
        n.name = "_"
        return self.generic_visit(n)

    def visit_ClassDef(self, n):
        n.name = "_"
        return self.generic_visit(n)

    def visit_ExceptHandler(self, n):
        # "except E as e" keeps its alias here, as a plain string
        n.name = "_" if n.name else n.name
        return self.generic_visit(n)

    def visit_Global(self, n):
        n.names = ["_"] * len(n.names)
        return n

    def visit_Nonlocal(self, n):
        n.names = ["_"] * len(n.names)
        return n


def shape(src):
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                                 ast.AsyncFunctionDef)):
            continue
        body = node.body
        if body and isinstance(body[0], ast.Expr) \
           and isinstance(body[0].value, ast.Constant) \
           and isinstance(body[0].value.value, str):
            if len(body) > 1:
                node.body = body[1:]
            elif not isinstance(node, ast.Module):
                node.body = [ast.Pass()]
            else:
                node.body = []
    return ast.dump(ast.fix_missing_locations(Blank().visit(tree)))


def main():
    files = sorted(glob.glob(sys.argv[1] if len(sys.argv) > 1 else "t/**/*.py",
                             recursive=True))
    same = changed = skipped = 0
    for path in files:
        src = open(path, encoding="utf-8").read()
        out = disguise(src, random.Random(0))
        if out is None:
            skipped += 1
            continue
        if shape(src) == shape(out):
            same += 1
        else:
            changed += 1
            print("  STRUCTURE CHANGED:", path)
    print(f"\n{len(files)} files: shape preserved {same}, changed {changed}, "
          f"not disguisable {skipped}")
    raise SystemExit(1 if changed else 0)


if __name__ == "__main__":
    main()
