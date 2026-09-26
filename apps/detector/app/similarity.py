import time
from dataclasses import dataclass

from apted import APTED
from apted.helpers import Tree

from app.normalise import TNode, size, to_bracket

# 610,000 node-pairs took 8.5 seconds on this machine (Sep 2026), so this
# cap is roughly a two second budget for a single comparison.
MAX_PRODUCT = 150_000


@dataclass
class Prepared:
    """A tree converted once, ready to be compared many times."""
    tree: Tree
    bracket: str
    node_count: int
    start_line: int
    end_line: int


@dataclass
class Comparison:
    similarity: float
    distance: float
    size_a: int
    size_b: int
    duration_ms: float


def prepare(node: TNode) -> Prepared:
    bracket = to_bracket(node)
    return Prepared(
        tree=Tree.from_text(bracket),
        bracket=bracket,
        node_count=size(node),
        start_line=node.start_line,
        end_line=node.end_line,
    )


def compare(a: Prepared, b: Prepared) -> Comparison | None:
    """Similarity of two prepared trees, or None if the pair was refused."""
    if a.node_count == 0 or b.node_count == 0:
        return None

    # Once normalised, copied code is often character for character the same
    # shape. A string comparison costs nothing beside tree edit distance.
    if a.bracket == b.bracket:
        return Comparison(1.0, 0, a.node_count, b.node_count, 0.0)

    if a.node_count * b.node_count > MAX_PRODUCT:
        return None

    started = time.perf_counter()
    distance = APTED(a.tree, b.tree).compute_edit_distance()
    elapsed = (time.perf_counter() - started) * 1000

    # The worst possible edit deletes every node of a and inserts every node
    # of b, so the distance cannot exceed the two sizes added together.
    similarity = 1 - distance / (a.node_count + b.node_count)

    return Comparison(
        similarity=round(similarity, 4),
        distance=distance,
        size_a=a.node_count,
        size_b=b.node_count,
        duration_ms=round(elapsed, 3),
    )
