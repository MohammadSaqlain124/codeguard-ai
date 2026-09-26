import time
from dataclasses import dataclass

from app.normalise import TNode, size
from app.prefilter import quick_similarity
from app.similarity import Prepared, compare, prepare

# What counts as a comparable unit, by language.
FUNCTION_LABELS = {
    "python": {"function_definition"},
    "java": {"method_declaration", "constructor_declaration"},
}

# Two units of very different sizes cannot score above this, so the
# comparison is not worth paying for. The ceiling is derived below.
SIZE_PRUNE_FLOOR = 0.5


@dataclass
class UnitMatch:
    similarity: float
    a_start: int
    a_end: int
    b_start: int
    b_end: int
    nodes_a: int
    nodes_b: int


@dataclass
class FileComparison:
    similarity: float
    matches: list[UnitMatch]
    units_a: int
    units_b: int
    compared_pairs: int
    pruned_pairs: int
    skipped_pairs: int
    coverage_a: float
    coverage_b: float
    duration_ms: float


def extract_units(root: TNode, language: str) -> list[Prepared]:
    """Every function or method in the file, each prepared for comparison."""
    labels = FUNCTION_LABELS.get(language, set())
    units: list[Prepared] = []

    stack = [root]
    while stack:
        node = stack.pop()
        if node.label in labels:
            # a nested function is part of its parent, so we stop here
            units.append(prepare(node))
        else:
            stack.extend(node.children)

    # a script with no functions at all is compared as one whole unit
    if not units:
        units.append(prepare(root))

    return units


def ceiling_for(a: Prepared, b: Prepared) -> float:
    """The best similarity two units of these sizes could possibly reach."""
    # turning one tree into the other needs at least enough edits to close
    # the size gap, so the distance can never be smaller than that gap
    gap = abs(a.node_count - b.node_count)
    return 1 - gap / (a.node_count + b.node_count)


def greedy(scored: list[tuple[float, int, int]]) -> list[tuple[int, int]]:
    """Strongest pair first, each unit used at most once."""
    scored.sort(reverse=True)
    used_a: set[int] = set()
    used_b: set[int] = set()
    chosen: list[tuple[int, int]] = []
    for _, i, j in scored:
        if i in used_a or j in used_b:
            continue
        used_a.add(i)
        used_b.add(j)
        chosen.append((i, j))
    return chosen


def compare_unit_sets(
    units_a: list[Prepared],
    units_b: list[Prepared],
    tree_size_a: int,
    tree_size_b: int,
    exhaustive: bool = False,
) -> FileComparison:
    started = time.perf_counter()
    compared = 0
    pruned = 0
    exact: dict[tuple[int, int], float] = {}

    if exhaustive:
        # every pair costed properly, and the matching decided from that
        scored = []
        for i, a in enumerate(units_a):
            for j, b in enumerate(units_b):
                if ceiling_for(a, b) < SIZE_PRUNE_FLOOR:
                    pruned += 1
                    continue
                result = compare(a, b)
                if result is None:
                    pruned += 1
                    continue
                compared += 1
                scored.append((result.similarity, i, j))
                exact[(i, j)] = result.similarity
        chosen = greedy(scored)
    else:
        # Matching only needs to know which pairing is better, so the cheap
        # score decides it, looking at every pair so nobody is left out.
        guesses = [
            (quick_similarity(a.labels, b.labels), i, j)
            for i, a in enumerate(units_a)
            for j, b in enumerate(units_b)
        ]
        chosen = greedy(guesses)

        # only the pairs we actually matched are worth the expensive score
        for i, j in chosen:
            a, b = units_a[i], units_b[j]
            if ceiling_for(a, b) < SIZE_PRUNE_FLOOR:
                pruned += 1
                continue
            result = compare(a, b)
            if result is None:
                pruned += 1
                continue
            compared += 1
            exact[(i, j)] = result.similarity

    matches: list[UnitMatch] = []
    weighted = 0.0
    for i, j in chosen:
        similarity = exact.get((i, j))
        if similarity is None:
            continue
        a, b = units_a[i], units_b[j]
        weighted += similarity * (a.node_count + b.node_count)
        matches.append(
            UnitMatch(
                similarity=similarity,
                a_start=a.start_line,
                a_end=a.end_line,
                b_start=b.start_line,
                b_end=b.end_line,
                nodes_a=a.node_count,
                nodes_b=b.node_count,
            )
        )

    matches.sort(key=lambda m: m.similarity, reverse=True)

    # unmatched units contribute nothing to the top but still count below,
    # so a file with extra code scores lower than one without
    total_a = sum(u.node_count for u in units_a)
    total_b = sum(u.node_count for u in units_b)
    denominator = total_a + total_b
    score = weighted / denominator if denominator else 0.0

    return FileComparison(
        similarity=round(score, 4),
        matches=matches,
        units_a=len(units_a),
        units_b=len(units_b),
        compared_pairs=compared,
        pruned_pairs=pruned,
        skipped_pairs=len(units_a) * len(units_b) - compared - pruned,
        coverage_a=round(total_a / tree_size_a, 3) if tree_size_a else 0.0,
        coverage_b=round(total_b / tree_size_b, 3) if tree_size_b else 0.0,
        duration_ms=round((time.perf_counter() - started) * 1000, 3),
    )


def compare_files(
    root_a: TNode,
    root_b: TNode,
    language: str,
    exhaustive: bool = False,
) -> FileComparison:
    """Convenience for one pair. File 066 prepares once and reuses instead."""
    return compare_unit_sets(
        extract_units(root_a, language),
        extract_units(root_b, language),
        size(root_a),
        size(root_b),
        exhaustive,
    )
