from collections import Counter

from app.normalise import TNode


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
    """Positions of the most promising candidates, best first.

    Used at FILE level, in main.py, to pick which of up to MAX_CANDIDATES
    submissions are worth a deep comparison. Unit matching inside a file
    does not shortlist: compare_unit_sets scores every pairing with
    quick_similarity, because a file holds few functions and the cheap
    score costs almost nothing.

    A two-sided shortlist_pairs helper used to live here, unused, and was
    removed on 24 Nov 2026. Keep its reasoning if unit-level shortlisting
    is ever added: nominating in one direction only starves units that
    nobody happens to pick. If every unit of A names the same five in B,
    the rest of B is never offered to anyone and their real partners in A
    go unmatched, so both sides have to nominate.
    """
    scored = [(quick_similarity(target, other), i) for i, other in enumerate(others)]
    scored.sort(reverse=True)
    return [i for _, i in scored[:top_k]]
