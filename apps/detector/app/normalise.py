from dataclasses import dataclass, field

from tree_sitter import Node

# Carries no structure worth comparing.
DROP = {"comment", "line_comment", "block_comment"}

# Every name becomes the same label, so renaming a variable changes nothing.
IDENTIFIERS = {
    "identifier",
    "type_identifier",
    "field_identifier",
    "scoped_identifier",
    "dotted_name",
}

NUMBERS = {
    "integer",
    "float",
    "decimal_integer_literal",
    "hex_integer_literal",
    "octal_integer_literal",
    "binary_integer_literal",
    "decimal_floating_point_literal",
    "hex_floating_point_literal",
}

STRINGS = {"string", "string_literal", "character_literal", "concatenated_string"}
BOOLEANS = {"true", "false"}
NULLS = {"none", "null_literal"}

# A literal is a leaf: what is inside a string is not structure.
LEAF_LABELS = {"ID", "NUM", "STR", "BOOL", "NULL"}

# One child and no meaning of its own, so we keep the child and drop the wrapper.
PASS_THROUGH = {"expression_statement", "parenthesized_expression"}

# Python can only recurse about 1000 frames deep. Real code nests nowhere
# near this, so anything past it is pathological rather than unusual.
MAX_DEPTH = 200


@dataclass
class TNode:
    label: str
    start_line: int
    end_line: int
    children: list["TNode"] = field(default_factory=list)


def label_for(node_type: str) -> str | None:
    """The comparable label for a tree-sitter type, or None to drop the node."""
    if node_type in DROP:
        return None
    if node_type in IDENTIFIERS:
        return "ID"
    if node_type in NUMBERS:
        return "NUM"
    if node_type in STRINGS:
        return "STR"
    if node_type in BOOLEANS:
        return "BOOL"
    if node_type in NULLS:
        return "NULL"
    return node_type


def normalise(node: Node, depth: int = 0) -> TNode | None:
    if not node.is_named:
        return None

    label = label_for(node.type)
    if label is None:
        return None

    # line numbers are kept so a later file can point at the evidence
    start = node.start_point[0] + 1
    end = node.end_point[0] + 1

    if label in LEAF_LABELS:
        return TNode(label, start, end)

    if depth >= MAX_DEPTH:
        return TNode("DEEP", start, end)

    children = []
    for child in node.children:
        kept = normalise(child, depth + 1)
        if kept is not None:
            children.append(kept)

    if label in PASS_THROUGH and len(children) == 1:
        return children[0]

    return TNode(label, start, end, children)


def size(root: TNode) -> int:
    count = 0
    stack = [root]
    while stack:
        node = stack.pop()
        count += 1
        stack.extend(node.children)
    return count


def to_bracket(node: TNode) -> str:
    """Bracket notation, which is the input format APTED reads: {a{b}{c}}."""
    inner = "".join(to_bracket(child) for child in node.children)
    return "{" + node.label + inner + "}"
