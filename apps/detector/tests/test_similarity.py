"""Tree edit distance, the short circuit, and the cost guard."""
from app.normalise import TNode
from app.similarity import MAX_PRODUCT, compare, prepare
from tests.conftest import tree, wide_tree


def test_a_tree_is_identical_to_itself(original):
    result = compare(prepare(original), prepare(original))
    assert result is not None
    assert result.similarity == 1.0
    assert result.distance == 0


def test_a_renamed_copy_scores_one(original, renamed):
    # the end to end version of the normalisation claim: this is the number
    # quoted in the report, so it belongs in the suite
    result = compare(prepare(original), prepare(renamed))
    assert result is not None
    assert result.similarity == 1.0


def test_identical_trees_short_circuit_before_apted(original):
    # equal bracket strings are answered by string comparison, so the
    # recorded duration is exactly zero rather than merely small
    result = compare(prepare(original), prepare(original))
    assert result.duration_ms == 0.0


def test_different_trees_actually_run_apted(original):
    other = tree("def f():\n    while True:\n        pass\n")
    result = compare(prepare(original), prepare(other))
    assert result is not None
    assert result.distance > 0
    assert result.duration_ms > 0


def test_similarity_stays_inside_zero_and_one(original):
    other = tree("x = 1\n")
    result = compare(prepare(original), prepare(other))
    assert result is not None
    assert 0.0 <= result.similarity <= 1.0


def test_similarity_is_symmetric(original):
    other = tree("def g(a):\n    return a\n")
    forward = compare(prepare(original), prepare(other))
    backward = compare(prepare(other), prepare(original))
    assert forward.similarity == backward.similarity


def test_unrelated_code_scores_below_a_renamed_copy(original, renamed):
    unrelated = tree("class Thing:\n    pass\n")
    copy_score = compare(prepare(original), prepare(renamed)).similarity
    other_score = compare(prepare(original), prepare(unrelated)).similarity
    assert other_score < copy_score


def test_an_empty_tree_is_refused():
    empty = TNode("ID", 1, 1)
    # a leaf has size one, so build the zero case by hand
    empty.label = "ID"
    a = prepare(empty)
    a.node_count = 0
    assert compare(a, prepare(empty)) is None


def test_the_cost_guard_refuses_an_expensive_pair():
    # two trees whose size product sits above the cap, and whose brackets
    # differ so the short circuit cannot answer first
    side = int(MAX_PRODUCT ** 0.5) + 50
    a = prepare(wide_tree("A", side))
    b = prepare(wide_tree("B", side))
    assert a.bracket != b.bracket
    assert a.node_count * b.node_count > MAX_PRODUCT
    assert compare(a, b) is None


def test_a_pair_just_under_the_cap_is_compared():
    side = 40
    a = prepare(wide_tree("A", side))
    b = prepare(wide_tree("B", side))
    assert a.node_count * b.node_count < MAX_PRODUCT
    assert compare(a, b) is not None


def test_prepare_records_what_the_caller_needs(original):
    ready = prepare(original)
    assert ready.node_count > 0
    assert ready.bracket.startswith("{")
    assert sum(ready.labels.values()) == ready.node_count
    assert ready.start_line == original.start_line
