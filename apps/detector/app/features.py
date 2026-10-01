from tree_sitter import Node

from app.normalise import DROP, IDENTIFIERS
# FUNCTION_LABELS lives in units.py today. If that dependency ever becomes
# awkward it belongs in normalise.py, which both files already import.
from app.units import FUNCTION_LABELS

# every language's function types in one set, since this file does not
# need to know which language it was handed
FUNCTION_TYPES = {label for labels in FUNCTION_LABELS.values() for label in labels}

LOOP_FOR = {"for_statement", "for_in_clause", "enhanced_for_statement"}
LOOP_WHILE = {"while_statement"}
PARAM_TYPES = {"parameters", "formal_parameters"}
BLOCK_TYPES = {"block"}

# the order is fixed so a stored baseline and a new measurement always
# line up, whatever order a dictionary happens to iterate in
FEATURE_NAMES = (
    "avg_line_length",
    "blank_line_ratio",
    "comment_density",
    "avg_identifier_length",
    "underscore_identifier_ratio",
    "avg_function_lines",
    "functions_per_100_lines",
    "max_block_depth",
    "avg_params_per_function",
    "for_loop_ratio",
)


def mean(values: list[float]) -> float | None:
    """None rather than zero when there was nothing to measure."""
    return sum(values) / len(values) if values else None


def extract_features(root: Node, source: bytes) -> dict[str, float | None]:
    """Ten numbers describing how this file was written, not what it does."""
    text = source.decode("utf-8", errors="replace")
    lines = text.splitlines()
    total_lines = len(lines)
    non_blank = [line for line in lines if line.strip()]
    blank_lines = total_lines - len(non_blank)

    named_nodes = 0
    comments = 0
    identifier_lengths: list[float] = []
    underscore_identifiers = 0
    function_lines: list[float] = []
    param_counts: list[float] = []
    for_loops = 0
    while_loops = 0
    max_depth = 0

    # depth travels with each node, so nesting is counted without recursion
    stack: list[tuple[Node, int]] = [(root, 0)]
    while stack:
        node, depth = stack.pop()

        if node.is_named:
            named_nodes += 1
            kind = node.type

            if kind in DROP:
                comments += 1
            elif kind in IDENTIFIERS:
                # slicing the source avoids depending on node.text, and the
                # byte length equals the character length for ascii names
                raw = source[node.start_byte : node.end_byte]
                identifier_lengths.append(len(raw))
                if b"_" in raw:
                    underscore_identifiers += 1
            elif kind in FUNCTION_TYPES:
                function_lines.append(node.end_point[0] - node.start_point[0] + 1)
            elif kind in PARAM_TYPES:
                param_counts.append(sum(1 for child in node.children if child.is_named))
            elif kind in LOOP_FOR:
                for_loops += 1
            elif kind in LOOP_WHILE:
                while_loops += 1

        deeper = depth + 1 if node.type in BLOCK_TYPES else depth
        max_depth = max(max_depth, deeper)
        for child in node.children:
            stack.append((child, deeper))

    loops = for_loops + while_loops

    return {
        "avg_line_length": mean([float(len(line)) for line in non_blank]),
        "blank_line_ratio": blank_lines / total_lines if total_lines else None,
        "comment_density": comments / named_nodes if named_nodes else None,
        "avg_identifier_length": mean(identifier_lengths),
        "underscore_identifier_ratio": (
            underscore_identifiers / len(identifier_lengths) if identifier_lengths else None
        ),
        "avg_function_lines": mean(function_lines),
        "functions_per_100_lines": (
            100 * len(function_lines) / total_lines if total_lines else None
        ),
        "max_block_depth": float(max_depth),
        "avg_params_per_function": mean(param_counts),
        "for_loop_ratio": for_loops / loops if loops else None,
    }
