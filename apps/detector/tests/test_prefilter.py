"""The cheap score, and the two sided shortlist that fixed the starvation bug."""
from collections import Counter

from app.prefilter import label_counts, quick_similarity, rank, shortlist_pairs
from tests.conftest import tree


def test_label_counts_totals_the_tree_size(original):
    from app.normalise import size

    assert sum(label_counts(original).values()) == size(original)


def test_identical_bags_score_one():
    bag = Counter({"ID": 4, "NUM": 2})
    assert quick_similarity(bag, bag) == 1.0


def test_disjoint_bags_score_zero():
    assert quick_similarity(Counter({"ID": 3}), Counter({"NUM": 3})) == 0.0


def test_empty_bags_do_not_divide_by_zero():
    assert quick_similarity(Counter(), Counter()) == 0.0


def test_one_empty_bag_scores_zero():
    assert quick_similarity(Counter({"ID": 2}), Counter()) == 0.0


def test_the_cheap_score_is_symmetric():
    a = Counter({"ID": 5, "NUM": 1})
    b = Counter({"ID": 2, "STR": 3})
    assert quick_similarity(a, b) == quick_similarity(b, a)


def test_partial_overlap_lands_between():
    a = Counter({"ID": 2})
    b = Counter({"ID": 1, "NUM": 1})
    # one label of three in common, counted twice over the total
    assert quick_similarity(a, b) == 2 * 1 / 4


def test_rank_returns_the_best_first():
    target = Counter({"ID": 10})
    others = [
        Counter({"NUM": 10}),   # nothing in common
        Counter({"ID": 10}),    # identical
        Counter({"ID": 5, "NUM": 5}),
    ]
    assert rank(target, others, 3)[0] == 1


def test_rank_respects_top_k():
    target = Counter({"ID": 1})
    others = [Counter({"ID": 1}) for _ in range(10)]
    assert len(rank(target, others, 4)) == 4


def test_rank_of_nothing_is_empty():
    assert rank(Counter({"ID": 1}), [], 5) == []


def test_the_shortlist_nominates_from_both_sides():
    # the starvation bug, as a regression test. Every unit of A prefers
    # b[0], so a one directional shortlist would never offer b[1] to
    # anybody and its real partner in A would go unmatched.
    labels_a = [Counter({"X": 10}), Counter({"X": 10}), Counter({"X": 10})]
    labels_b = [Counter({"X": 10}), Counter({"Y": 10})]

    pairs = shortlist_pairs(labels_a, labels_b, top_k=1)

    chosen_by_a = {j for i, j in pairs}
    assert 0 in chosen_by_a, "the obvious match should be shortlisted"
    assert 1 in chosen_by_a, "b[1] was starved: nothing nominated it"


def test_the_shortlist_covers_every_unit_on_both_sides():
    labels_a = [Counter({"X": 5}), Counter({"Y": 5})]
    labels_b = [Counter({"X": 5}), Counter({"Y": 5}), Counter({"Z": 5})]

    pairs = shortlist_pairs(labels_a, labels_b, top_k=1)

    assert {i for i, _ in pairs} == {0, 1}
    assert {j for _, j in pairs} == {0, 1, 2}


def test_real_trees_rank_a_copy_above_a_stranger(original, renamed):
    stranger = tree("class Thing:\n    pass\n")
    target = label_counts(original)
    others = [label_counts(stranger), label_counts(renamed)]
    assert rank(target, others, 2)[0] == 1
