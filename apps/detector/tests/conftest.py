"""Shared fixtures for the detector tests.

The sources below are deliberately tiny and hand written. Every one of them
exists to make a single claim checkable, so none of them should be edited
without checking which test it was written for.
"""
import os

import pytest

from app.normalise import TNode, normalise
from app.parsing import parse_source

# main.py refuses to start without this, which is deliberate. It is set here
# because conftest runs before any test module imports the app, and the value
# only has to satisfy the length check: these tests do not verify the secret,
# they verify that one is required.
TEST_TOKEN = "test-detector-token-not-a-real-secret-0123456789"
os.environ["DETECTOR_TOKEN"] = TEST_TOKEN

# Two programs with the same structure and different names. Everything
# Layer 1 claims rests on these two normalising to the same tree.
PY_ORIGINAL = """\
def total(numbers):
    result = 0
    for n in numbers:
        result = result + n
    return result
"""

PY_RENAMED = """\
def summed(values):
    acc = 0
    for v in values:
        acc = acc + v
    return acc
"""

# Same code as PY_ORIGINAL with comments added, for the drop rule.
PY_COMMENTED = """\
# adds up a list
def total(numbers):
    # start from nothing
    result = 0
    for n in numbers:
        result = result + n  # keep going
    return result
"""

# Different literal kinds, for the collapse rules.
PY_LITERALS = """\
def pick():
    a = 42
    b = 3.5
    c = "hello"
    d = True
    e = None
    return a, b, c, d, e
"""

# Two functions, so unit extraction has something to find.
PY_TWO_FUNCTIONS = """\
def first(x):
    return x + 1


def second(y):
    total = 0
    for i in range(y):
        total = total + i
    return total
"""

# The same two functions in the other order, for reordering invariance.
PY_TWO_REORDERED = """\
def second(y):
    total = 0
    for i in range(y):
        total = total + i
    return total


def first(x):
    return x + 1
"""

# A function containing a nested one, so we can check that the nested
# function is not extracted as a unit of its own.
PY_NESTED_FUNCTION = """\
def outer(n):
    def inner(m):
        return m * 2
    return inner(n)
"""

# No functions at all, so the whole file becomes one unit.
PY_NO_FUNCTIONS = """\
x = 1
y = x + 2
print(y)
"""

PY_BROKEN = """\
def total(numbers):
    result = 0
    for n in numbers
        result = result + n
    return result
"""

JAVA_SIMPLE = """\
class Adder {
    int add(int a, int b) {
        return a + b;
    }
}
"""


def tree(source: str, language: str = "python") -> TNode:
    """Parse and normalise, failing the test if the source does not parse."""
    parsed = parse_source(language, source)
    assert parsed.ok, f"fixture does not parse: {parsed.error}"
    normalised = normalise(parsed.root)
    assert normalised is not None, "fixture normalised to nothing"
    return normalised


def wide_tree(label: str, children: int) -> TNode:
    """A synthetic tree of a chosen size, for the cost guards."""
    return TNode(label, 1, 1, [TNode(f"{label}{i}", 1, 1) for i in range(children)])


@pytest.fixture
def original():
    return tree(PY_ORIGINAL)


@pytest.fixture
def renamed():
    return tree(PY_RENAMED)


@pytest.fixture
def commented():
    return tree(PY_COMMENTED)


@pytest.fixture
def two_functions():
    return tree(PY_TWO_FUNCTIONS)


@pytest.fixture
def two_reordered():
    return tree(PY_TWO_REORDERED)
