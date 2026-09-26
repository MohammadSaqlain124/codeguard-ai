from collections import Counter

from app.normalise import TNode

# How many candidates each item is compared against properly. Small enough
# to be worth it, large enough that the real match is very likely inside.
TOP_K_UNITS = 5


def label_counts(root: TNode) -> Counter:
    """How many nodes of each kind the tree holds, ignoring its shape."""
    counts: Counter = Counter()
    stack = [root]
    while stack:
        node = stack.pop()
        counts[node.label] += 1
        stack.extend(node.children)
    return counts


def quick_similarity(a: Counter, b: Counter) -> float:
    """Overlap of two label bags, 0 to 1. Cheap, approximate, never final."""
    total = sum(a.values()) + sum(b.values())
    if total == 0:
        return 0.0
    # count what the two trees have in common, kind by kind
    shared = sum(min(a[label], b[label]) for label in a.keys() & b.keys())
    return 2 * shared / total


def rank(target: Counter, others: list[Counter], top_k: int) -> list[int]:
    """Positions of the most promising candidates, best first."""
    scored = [(quick_similarity(target, other), i) for i, other in enumerate(others)]
    scored.sort(reverse=True)
    return [i for _, i in scored[:top_k]]
