"""Does Layer 2 separate authors in Java?

Replicates the Day 19 Python measurement on Java, so the two can be compared:
same ownership threshold, same line bounds, same per-author cap, same
leave-one-out nearest-centroid classifier on z-scored features. Everything
except the repository list and the file filters lives in common.py, which the
Python script imports too, so the two runs are the same code rather than two
descriptions of the same method.

Features come from the real detector, not a replica, so there is nothing that
can disagree with the running service.

Run it from apps/detector:

    python measurements/java_authorship.py --work /tmp/javarepos

Disk: the eleven repositories need full history, because git blame on a
shallow clone attributes every line to the boundary commit. They came to
655 MB in October 2026, so budget about 2 GB and do not start below 5 GB free.
Pass --skip-clone to reuse a work directory you already have.
"""
from common import Language, run

JAVA = Language(
    name="java",
    extension=".java",
    repos=[
        "stleary/JSON-java", "google/gson", "jhy/jsoup",
        "brettwooldridge/HikariCP", "apache/commons-lang", "apache/commons-io",
        "apache/commons-csv", "apache/commons-text", "FasterXML/jackson-core",
        "dropwizard/metrics", "zxing/zxing",
    ],
    # Each merge below was confirmed by reading the commit emails: the 59b500cc
    # suffixes are an SVN to git migration artefact from zxing's Google Code
    # history.
    aliases={
        "srowen": "sean owen",
        "srowengmailcom": "sean owen",
        "gary d gregory": "gary gregory",
    },
    excluded_dirs=("/test/", "/tests/", "/androidtest/", "/generated", "/target/"),
    excluded_suffixes=("Test.java", "Tests.java", "TestCase.java", "IT.java"),
    excluded_names=("package-info.java",),
)


if __name__ == "__main__":
    run(JAVA)
