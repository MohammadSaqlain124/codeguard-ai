import time
from dataclasses import dataclass

from apted import APTED
from apted.helpers import Tree

from app.normalise import TNode, size, to_bracket

# One comparison costs roughly the product of the two tree sizes. Past this
# we refuse, rather than let one submission hold a worker for minutes.
MAX_PRODUCT = 4_000_000


@dataclass
class Prepared:
    """A tree converted once, ready to be compared many times."""
    tree: Tree
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
    return Prepared(
        tree=Tree.from_text(to_bracket(node)),
        node_count=size(node),
        start_line=node.start_line,
        end_line=node.end_line,
    )


def compare(a: Prepared, b: Prepared) -> Comparison | None:
    """Similarity of two prepared trees, or None if the pair was refused."""
    if a.node_count == 0 or b.node_count == 0:
        return None
    if a.node_count * b.node_count > MAX_PRODUCT:
        return None

    started = time.perf_counter()
    distance = APTED(a.tree, b.tree).compute_edit_distance()
    elapsed = (time.perf_counter() - started) * 1000

    # The worst possible edit is deleting every node of a and inserting
    # every node of b, so the distance cannot exceed the two sizes added
    # together. Dividing by that sum keeps the result inside 0 to 1.
    similarity = 1 - distance / (a.node_count + b.node_count)

    return Comparison(
        similarity=round(similarity, 4),
        distance=distance,
        size_a=a.node_count,
        size_b=b.node_count,
        duration_ms=round(elapsed, 3),
    )
