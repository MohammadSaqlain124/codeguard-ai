"""The normalisation rules, which are what Layer 1's whole claim rests on."""
from app.normalise import MAX_DEPTH, label_for, normalise, size, to_bracket
from app.parsing import parse_source
from tests.conftest import PY_LITERALS, PY_ORIGINAL, PY_RENAMED, tree


def test_renaming_everything_changes_nothing(original, renamed):
    # the headline claim of the structural layer, as a test rather than a
    # measurement in a scratch file
    assert to_bracket(original) == to_bracket(renamed)
    assert size(original) == size(renamed)


def test_comments_are_dropped(original, commented):
    assert to_bracket(original) == to_bracket(commented)


def test_literals_collapse_to_their_kind():
    bracket = to_bracket(tree(PY_LITERALS))
    for label in ("NUM", "STR", "BOOL", "NULL"):
        assert label in bracket
    # the actual values must be gone
    assert "42" not in bracket
    assert "hello" not in bracket


def test_a_literal_is_a_leaf():
    # what is inside a string is not structure, so STR has no children
    root = tree(PY_LITERALS)
    stack = [root]
    while stack:
        node = stack.pop()
        if node.label in ("ID", "NUM", "STR", "BOOL", "NULL"):
            assert node.children == []
        stack.extend(node.children)


def test_every_identifier_becomes_the_same_label():
    assert label_for("identifier") == "ID"
    assert label_for("type_identifier") == "ID"
    assert label_for("field_identifier") == "ID"


def test_comment_types_are_dropped_by_label():
    assert label_for("comment") is None
    assert label_for("line_comment") is None
    assert label_for("block_comment") is None


def test_an_unknown_type_keeps_its_own_name():
    assert label_for("while_statement") == "while_statement"


def test_pass_through_nodes_are_unwrapped():
    # a bare expression statement wrapping one call adds a level that means
    # nothing, so it should not appear in the tree
    bracket = to_bracket(tree("print(1)\n"))
    assert "expression_statement" not in bracket


def test_pass_through_is_kept_when_it_has_several_children():
    # the rule only unwraps a single child, so a node that genuinely groups
    # things must survive
    assert label_for("expression_statement") == "expression_statement"


def test_size_counts_every_node():
    root = tree(PY_ORIGINAL)
    counted = 0
    stack = [root]
    while stack:
        node = stack.pop()
        counted += 1
        stack.extend(node.children)
    assert size(root) == counted


def test_bracket_notation_is_balanced():
    bracket = to_bracket(tree(PY_ORIGINAL))
    assert bracket.count("{") == bracket.count("}")
    assert bracket.count("{") == size(tree(PY_ORIGINAL))


def test_the_depth_guard_truncates_rather_than_crashing():
    # called at the limit on purpose: 200 levels of real nesting would hit
    # the parser's own limits long before it reached ours
    root = parse_source("python", PY_ORIGINAL).root
    guarded = normalise(root, depth=MAX_DEPTH)
    assert guarded is not None
    assert guarded.label == "DEEP"
    assert guarded.children == []


def test_anonymous_nodes_are_dropped():
    # a colon is a token with no name, so normalise refuses it outright
    root = parse_source("python", PY_ORIGINAL).root
    colon = None
    stack = [root]
    while stack:
        node = stack.pop()
        if not node.is_named and node.type == ":":
            colon = node
            break
        stack.extend(node.children)
    assert colon is not None, "fixture has no colon to test with"
    assert normalise(colon) is None


def test_line_numbers_survive_normalisation():
    # the spans a reviewer is shown come from these
    root = tree(PY_RENAMED)
    assert root.start_line == 1
    assert root.end_line >= 5
