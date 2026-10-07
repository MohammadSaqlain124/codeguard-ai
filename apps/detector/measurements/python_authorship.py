"""Does Layer 2 separate authors in Python, with the project held constant?

Re-runs the Day 19 measurement properly. That run reported 2.27x and 3.15x from
a deleted scratch file, so its numbers could not be reproduced, and on the
evidence of the Java run it carried two unreported problems: every author in a
sample like this writes in one repository, so "which author" and "which
project" are the same question, and the per-author cap made the result depend
on an arbitrary choice of which files to keep.

Everything except the repository list and the file filters lives in common.py,
which the Java script imports too, so the two measurements are the same code
rather than two descriptions of the same method.

Run it from apps/detector:

    python measurements/python_authorship.py --work /tmp/pyrepos

Disk: the eleven repositories need full history, because git blame on a
shallow clone attributes every line to the boundary commit. They came to
1.1 GB in October 2026, so budget about 3.5 GB and do not start below 25 GB
free. Pass --skip-clone to reuse a work directory you already have.
"""
from common import Language, run

PYTHON = Language(
    name="python",
    extension=".py",
    # Chosen for author diversity rather than fame: the Java run's weakness was
    # that most repositories held only two or three eligible authors, which is
    # why two of its four within-repository figures came out indistinguishable
    # from chance. django and pytest in particular should put enough authors
    # inside one project to make that test mean something.
    repos=[
        "psf/requests", "pallets/flask", "pallets/click",
        "pytest-dev/pytest", "scrapy/scrapy", "celery/celery",
        "urllib3/urllib3", "python-pillow/Pillow", "mitmproxy/mitmproxy",
        "psf/black", "django/django",
        # Added after a first pass on the eleven above produced only nine
        # eligible authors, and no repository with more than three. These four
        # are modular enough that individual people own whole subpackages,
        # which is what puts several authors inside one project.
        "sympy/sympy", "scikit-learn/scikit-learn", "joke2k/faker",
        "aio-libs/aiohttp",
    ],
    # Built by grouping every commit author name in these repositories by
    # commit email, then hand checking each group. Leaving it empty would
    # understate every result, because one human under several names moves
    # within-author variance into the between-author term, and because two
    # spellings inside one file deflate that file's ownership share below the
    # 85% cut and drop it from the sample.
    aliases={
        # scrapy. Adrian Chaves commits as a bare "adrian" from his zyte.com
        # address. Adrian Moennich (thiefmaster) shares the display name from a
        # different address and is a different person, so he is not merged.
        "adrian": "adrian chaves",
        # sympy. One bjodah@gmail.com address, four spellings, one of them a
        # typo in the configured name.
        "bjrn dahlgren": "bjorn dahlgren",
        "bjrn dahlhren": "bjorn dahlgren",
        "bjrn ingvar dahlgren": "bjorn dahlgren",
        "bjorn": "bjorn dahlgren",
        # sympy
        "sy lee": "sangyub lee",
        "lazard sy lee": "sangyub lee",
        "sylee957": "sangyub lee",
        "chris smith": "christopher smith",
        "smichr": "christopher smith",
        "davide": "davide sandon",
        "davidesd": "davide sandon",
        "meclark256": "mary clark",
        "sachin": "sachin joglekar",
        "srjoglekar246": "sachin joglekar",
        "smitcreate": "smit lunagariya",
        "mohitbalwani26": "mohit balwani",
        "ondej ertk": "ondrej certik",
        "brian granger": "brian e granger",
        # scikit-learn. One of Loic Esteve's spellings is a mojibaked
        # quoted-printable header, which only email grouping finds.
        "lesteve": "loic esteve",
        "loc estve": "loic esteve",
        "utf8qloc3afc20estc3a8ve": "loic esteve",
        "thomas fan": "thomas j fan",
        "jeremiedbb": "jeremie du boisberranger",
        "jrmie du boisberranger": "jeremie du boisberranger",
        "adrinjalali": "adrin jalali",
        # Pillow
        "hugo": "hugo van kemenade",
        "hugovk": "hugo van kemenade",
        # django
        "nessita": "natalia bidart",
        "natalia": "natalia bidart",
        "adam chainz": "adam johnson",
        # celery
        "ask solem hoel": "ask solem",
        # scrapy
        "andrey rahmatullin": "andrey rakhmatullin",
        # pytest
        "nicoddemus": "bruno oliveira",
        # aiohttp
        "medmunds": "mike edmunds",
        "leomanga": "leonardo mangani",
    },
    excluded_dirs=(
        "/test/", "/tests/", "/testing/", "/migrations/", "/_vendor/",
        "/vendor/", "/generated", "/build/", "/docs/", "/examples/",
        "/example/", "/benchmarks/", "/.tox/",
    ),
    excluded_suffixes=("_test.py", "_tests.py"),
    excluded_prefixes=("test_",),
    # __init__.py is the analogue of java's package-info.java: mostly
    # re-exports, so its style is the packaging convention and not the author's.
    excluded_names=(
        "__init__.py", "__main__.py", "conftest.py", "setup.py",
        "_version.py", "versioneer.py",
    ),
)


if __name__ == "__main__":
    run(PYTHON)
