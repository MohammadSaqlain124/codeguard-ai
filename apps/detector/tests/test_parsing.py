"""parse_source and the two tree walkers around it."""
from app.parsing import count_named_nodes, first_error_line, parse_source
from tests.conftest import JAVA_SIMPLE, PY_BROKEN, PY_ORIGINAL


def test_clean_python_parses():
    result = parse_source("python", PY_ORIGINAL)
    assert result.ok
    assert result.error is None
    assert result.root is not None
    assert result.node_count > 0


def test_clean_java_parses():
    result = parse_source("java", JAVA_SIMPLE)
    assert result.ok
    assert result.node_count > 0


def test_unknown_language_is_refused_without_parsing():
    result = parse_source("rust", PY_ORIGINAL)
    assert not result.ok
    assert result.node_count == 0
    assert result.root is None
    assert "rust" in result.error


def test_broken_source_is_reported_not_scored():
    result = parse_source("python", PY_BROKEN)
    assert not result.ok
    assert "does not parse" in result.error
    # the root is still handed back, so a caller can report a node count
    assert result.root is not None


def test_the_error_message_names_a_line():
    result = parse_source("python", PY_BROKEN)
    # the missing colon is on line 3 of the fixture
    assert "line 3" in result.error


def test_first_error_line_is_none_for_a_clean_tree():
    result = parse_source("python", PY_ORIGINAL)
    assert first_error_line(result.root) is None


def test_node_count_ignores_punctuation():
    # the parentheses and colon are anonymous tokens, so a count of named
    # nodes must come out lower than a count of everything
    root = parse_source("python", PY_ORIGINAL).root

    def count_all(node):
        return 1 + sum(count_all(child) for child in node.children)

    assert count_named_nodes(root) < count_all(root)


def test_empty_source_parses_to_an_empty_module():
    result = parse_source("python", "")
    assert result.ok
    assert result.node_count >= 1
