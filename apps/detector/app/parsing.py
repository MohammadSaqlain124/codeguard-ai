from dataclasses import dataclass

import tree_sitter_java as tsjava
import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser

# The grammars are compiled extension modules. Loading one is slow enough
# that we do it once at import rather than per request.
PARSERS = {
    "python": Parser(Language(tspython.language())),
    "java": Parser(Language(tsjava.language())),
}


@dataclass
class ParseResult:
    ok: bool
    node_count: int
    error: str | None = None
    root: Node | None = None


def count_named_nodes(root: Node) -> int:
    """Counts the nodes that carry meaning, ignoring punctuation tokens."""
    count = 0
    stack = [root]
    while stack:
        node = stack.pop()
        if node.is_named:
            count += 1
        stack.extend(node.children)
    return count


def first_error_line(root: Node) -> int | None:
    """Line number of the earliest broken node, or None if the tree is clean."""
    stack = [root]
    while stack:
        node = stack.pop()
        if node.type == "ERROR" or node.is_missing:
            # start_point is (row, column) counted from zero
            return node.start_point[0] + 1
        # reversed, so popping walks the children left to right
        stack.extend(reversed(node.children))
    return None


def parse_source(language: str, source: str) -> ParseResult:
    parser = PARSERS.get(language)
    if parser is None:
        return ParseResult(ok=False, node_count=0, error=f"No grammar for language {language}")

    # tree-sitter works on bytes, and the API stored these files as utf-8
    tree = parser.parse(source.encode("utf-8"))
    root = tree.root_node
    count = count_named_nodes(root)

    # tree-sitter always returns a tree, even for nonsense, with ERROR nodes
    # where it could not make sense of the text. A tree built around errors
    # is not safe to compare, so we report it rather than score it.
    if root.has_error:
        line = first_error_line(root)
        where = f" near line {line}" if line else ""
        return ParseResult(ok=False, node_count=count, error=f"Source does not parse cleanly{where}", root=root)

    return ParseResult(ok=True, node_count=count, root=root)
