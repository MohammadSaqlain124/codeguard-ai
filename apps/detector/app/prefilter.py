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

def shortlist_pairs(
    labels_a: list[Counter],
    labels_b: list[Counter],
    top_k: int,
) -> set[tuple[int, int]]:
    """Pairs worth comparing properly, nominated from both sides.

    Shortlisting in one direction only starves units that nobody happens
    to pick: if every unit of A names the same five in B, the rest of B is
    never offered to anyone, and their partners in A end up unmatched.
    """
    pairs: set[tuple[int, int]] = set()
    for i, a in enumerate(labels_a):
        for j in rank(a, labels_b, top_k):
            pairs.add((i, j))
    for j, b in enumerate(labels_b):
        for i in rank(b, labels_a, top_k):
            pairs.add((i, j))
    return pairs
