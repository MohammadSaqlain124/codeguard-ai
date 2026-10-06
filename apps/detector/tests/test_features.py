"""The ten style features, and the None rather than zero rule."""
from app.features import FEATURE_NAMES, extract_features, mean
from app.parsing import parse_source
from tests.conftest import PY_NO_FUNCTIONS, PY_ORIGINAL, PY_TWO_FUNCTIONS


def measure(source: str, language: str = "python"):
    parsed = parse_source(language, source)
    assert parsed.ok, parsed.error
    return extract_features(parsed.root, source.encode("utf-8"))


def test_every_declared_feature_is_produced():
    values = measure(PY_ORIGINAL)
    assert set(values) == set(FEATURE_NAMES)


def test_the_order_is_fixed():
    # a stored baseline lines up against a new measurement by this order,
    # so it is a tuple and it must not drift
    assert isinstance(FEATURE_NAMES, tuple)
    assert FEATURE_NAMES[0] == "avg_line_length"
    assert len(FEATURE_NAMES) == 10


def test_mean_of_nothing_is_none_not_zero():
    assert mean([]) is None
    assert mean([1.0, 3.0]) == 2.0


def test_a_feature_that_does_not_apply_is_none():
    # the decision the whole of Layer 2 rests on. A file with no loops does
    # not have a for loop ratio of zero; the question does not apply.
    values = measure(PY_NO_FUNCTIONS)
    assert values["for_loop_ratio"] is None
    assert values["avg_function_lines"] is None
    assert values["avg_params_per_function"] is None


def test_an_applicable_feature_is_a_number():
    values = measure(PY_ORIGINAL)
    assert values["for_loop_ratio"] == 1.0
    assert values["avg_function_lines"] is not None


def test_only_for_loops_gives_a_ratio_of_one():
    values = measure("for i in range(3):\n    print(i)\n")
    assert values["for_loop_ratio"] == 1.0


def test_only_while_loops_gives_a_ratio_of_zero():
    # zero here is a real measurement, not an absence: there were loops and
    # none of them were for loops
    values = measure("while True:\n    break\n")
    assert values["for_loop_ratio"] == 0.0


def test_blank_line_ratio_is_counted_over_every_line():
    source = "x = 1\n\ny = 2\n\n"
    values = measure(source)
    # four lines, two of them blank
    assert values["blank_line_ratio"] == 0.5


def test_a_file_with_no_blank_lines_scores_zero():
    values = measure("x = 1\ny = 2\n")
    assert values["blank_line_ratio"] == 0.0


def test_comment_density_rises_with_comments():
    bare = measure("x = 1\ny = 2\n")
    noisy = measure("# one\nx = 1\n# two\ny = 2\n")
    assert noisy["comment_density"] > bare["comment_density"]


def test_underscore_ratio_notices_the_habit():
    plain = measure("def f(a):\n    return a\n")
    snake = measure("def my_function(my_arg):\n    return my_arg\n")
    assert snake["underscore_identifier_ratio"] > plain["underscore_identifier_ratio"]


def test_functions_per_hundred_lines_scales_with_the_count():
    one = measure(PY_ORIGINAL)
    two = measure(PY_TWO_FUNCTIONS)
    assert two["avg_function_lines"] is not None
    assert one["functions_per_100_lines"] is not None
    assert two["functions_per_100_lines"] > 0


def test_deeper_nesting_raises_the_block_depth():
    shallow = measure("def f():\n    return 1\n")
    deep = measure(
        "def f():\n"
        "    if True:\n"
        "        for i in range(3):\n"
        "            return i\n"
    )
    assert deep["max_block_depth"] > shallow["max_block_depth"]


def test_average_line_length_ignores_blank_lines():
    # two content lines of four characters each, plus a blank one
    values = measure("ab=1\n\ncd=2\n")
    assert values["avg_line_length"] == 4.0


def test_identifier_length_is_measured_in_characters():
    values = measure("abcd = 1\n")
    assert values["avg_identifier_length"] == 4.0


def test_java_measures_fewer_features_than_python():
    # recorded on Day 18 and worth keeping: the two languages do not even
    # yield the same number of measurable features, which is why a baseline
    # is per language
    java = measure("class A {}\n", "java")
    python = measure(PY_ORIGINAL)
    measured_java = sum(1 for v in java.values() if v is not None)
    measured_python = sum(1 for v in python.values() if v is not None)
    assert measured_java < measured_python


def test_an_empty_file_measures_nothing_rather_than_zero():
    values = measure("")
    for name in ("avg_line_length", "avg_identifier_length", "for_loop_ratio"):
        assert values[name] is None
