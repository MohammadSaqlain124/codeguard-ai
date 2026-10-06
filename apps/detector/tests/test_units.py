"""Unit extraction, the size ceiling, greedy matching and the file score."""
from app.normalise import size
from app.similarity import prepare
from app.units import (
    SIZE_PRUNE_FLOOR,
    ceiling_for,
    compare_files,
    compare_unit_sets,
    extract_units,
    greedy,
)
from tests.conftest import (
    PY_NESTED_FUNCTION,
    PY_NO_FUNCTIONS,
    PY_TWO_FUNCTIONS,
    tree,
    wide_tree,
)


def test_each_function_becomes_one_unit(two_functions):
    assert len(extract_units(two_functions, "python")) == 2


def test_a_nested_function_is_not_a_unit_of_its_own():
    # a nested function is part of its parent, so the walk stops at the outer one
    units = extract_units(tree(PY_NESTED_FUNCTION), "python")
    assert len(units) == 1


def test_a_script_with_no_functions_is_one_whole_unit():
    root = tree(PY_NO_FUNCTIONS)
    units = extract_units(root, "python")
    assert len(units) == 1
    assert units[0].node_count == size(root)


def test_an_unknown_language_falls_back_to_the_whole_file(two_functions):
    # no function labels for the language means no units found, and the
    # whole tree is compared instead of nothing at all
    units = extract_units(two_functions, "cobol")
    assert len(units) == 1
    assert units[0].node_count == size(two_functions)


def test_equal_sizes_have_a_ceiling_of_one():
    a = prepare(wide_tree("A", 10))
    b = prepare(wide_tree("B", 10))
    assert ceiling_for(a, b) == 1.0


def test_the_ceiling_falls_as_the_size_gap_grows():
    small = prepare(wide_tree("A", 4))
    close = prepare(wide_tree("B", 5))
    far = prepare(wide_tree("C", 40))
    assert ceiling_for(small, close) > ceiling_for(small, far)


def test_a_wide_size_gap_drops_below_the_prune_floor():
    small = prepare(wide_tree("A", 2))
    huge = prepare(wide_tree("B", 100))
    assert ceiling_for(small, huge) < SIZE_PRUNE_FLOOR


def test_greedy_uses_each_unit_at_most_once():
    # both pairs want unit 0 on each side; only the stronger may have it
    chosen = greedy([(0.9, 0, 0), (0.8, 0, 1), (0.7, 1, 0), (0.6, 1, 1)])
    assert (0, 0) in chosen
    assert len({i for i, _ in chosen}) == len(chosen)
    assert len({j for _, j in chosen}) == len(chosen)


def test_greedy_takes_the_strongest_pair_first():
    chosen = greedy([(0.1, 0, 1), (0.9, 0, 0)])
    assert chosen[0] == (0, 0)


def test_a_file_is_identical_to_itself(two_functions):
    result = compare_files(two_functions, two_functions, "python")
    assert result.similarity == 1.0
    assert result.units_a == result.units_b == 2


def test_reordering_the_functions_does_not_change_the_score(two_functions, two_reordered):
    # reordering invariance is a stated design property of comparing at the
    # function level rather than whole file
    result = compare_files(two_functions, two_reordered, "python")
    assert result.similarity == 1.0


def test_a_renamed_file_still_scores_one(original, renamed):
    assert compare_files(original, renamed, "python").similarity == 1.0


def test_the_file_score_stays_inside_zero_and_one(two_functions):
    other = tree("class Thing:\n    def go(self):\n        return 1\n")
    result = compare_files(two_functions, other, "python")
    assert 0.0 <= result.similarity <= 1.0


def test_extra_code_lowers_the_score(original):
    # one file is the other plus a second function, so the unmatched unit
    # counts in the denominator and pulls the score down
    bigger = tree(PY_TWO_FUNCTIONS)
    same = compare_files(original, original, "python").similarity
    diluted = compare_files(original, bigger, "python").similarity
    assert diluted < same


def test_the_exhaustive_path_agrees_with_the_cheap_one(two_functions, two_reordered):
    cheap = compare_files(two_functions, two_reordered, "python", exhaustive=False)
    exact = compare_files(two_functions, two_reordered, "python", exhaustive=True)
    assert cheap.similarity == exact.similarity


def test_the_exhaustive_path_costs_more_comparisons(two_functions):
    other = tree(PY_TWO_FUNCTIONS)
    cheap = compare_files(two_functions, other, "python", exhaustive=False)
    exact = compare_files(two_functions, other, "python", exhaustive=True)
    assert exact.compared_pairs >= cheap.compared_pairs


def test_coverage_reports_how_much_of_the_file_was_in_a_unit():
    root = tree(PY_TWO_FUNCTIONS)
    units = extract_units(root, "python")
    result = compare_unit_sets(units, units, size(root), size(root))
    assert 0.0 < result.coverage_a <= 1.0
    assert result.coverage_a == result.coverage_b


def test_the_pair_counts_add_up(two_functions):
    other = tree(PY_TWO_FUNCTIONS)
    result = compare_files(two_functions, other, "python")
    total = result.units_a * result.units_b
    assert result.compared_pairs + result.pruned_pairs + result.skipped_pairs == total


def test_matches_come_back_strongest_first(two_functions):
    other = tree("def first(x):\n    return x + 1\n\n\ndef third(z):\n    return z\n")
    result = compare_files(two_functions, other, "python")
    scores = [m.similarity for m in result.matches]
    assert scores == sorted(scores, reverse=True)


def test_every_match_carries_line_spans(two_functions):
    result = compare_files(two_functions, two_functions, "python")
    for match in result.matches:
        assert match.a_start >= 1
        assert match.a_end >= match.a_start
        assert match.nodes_a > 0


def test_the_size_prune_fires_on_a_wide_gap():
    # the prune never fires on real function pairs, because functions inside
    # one file have similar sizes. This forces the gap so the guard is
    # observed working at least once.
    tiny = [prepare(wide_tree("A", 2))]
    huge = [prepare(wide_tree("B", 200))]
    result = compare_unit_sets(tiny, huge, 3, 201)
    assert result.pruned_pairs > 0
    assert result.compared_pairs == 0
    assert result.similarity == 0.0


def test_the_size_prune_fires_in_exhaustive_mode_too():
    tiny = [prepare(wide_tree("A", 2))]
    huge = [prepare(wide_tree("B", 200))]
    result = compare_unit_sets(tiny, huge, 3, 201, exhaustive=True)
    assert result.pruned_pairs > 0
    assert result.compared_pairs == 0
