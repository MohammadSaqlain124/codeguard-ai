## 2026-09-04 — Day 1 — File 001: README.md

**What we built:** The project README — problem statement, the
"evidence not verdict" framing, three-layer overview, baseline
integrity section including the honest limitation, ASCII
architecture diagram, tech stack, repo layout, setup steps, scope,
and team table.

**Why we built it:** It is the entry point for four audiences —
teammates getting set up, the guide at review meetings, the external
examiner forming a first impression, and me in month 7 having
forgotten a decision. GitHub renders it automatically at the repo
root, so it is unavoidably the project's front page.

**Why a separate file:** GitHub only auto-renders a file named
README.md at the root. Anywhere else and nobody finds it. It is also
distinct from PROJECT_NOTES.md by time direction — the README
describes the project as it *is* and gets rewritten; PROJECT_NOTES
is append-only history that never gets edited.

**Libraries introduced:** None. Markdown (GitHub Flavored) is a
markup format, not a library. Chosen over plain text because GitHub
renders headings and tables; over HTML because Markdown stays
readable as a raw file and produces clean git diffs.

**Functions written:** None. Documentation file.

**Concepts learned:** repository · repo root · commit · Markdown ·
GitHub Flavored Markdown · fenced code block · untracked file ·
upstream remote · main vs master branch

**Problem faced:** None technically. The real decision was whether
to publish the baseline-poisoning limitation in the README.

**How we solved it:** Published it. An examiner who discovers an
unmentioned flaw concludes we did not understand our own system. An
examiner who reads that we found it, named it, built five
mitigations against it, and stated the residual gap concludes the
opposite. Naming the weakness is what makes the mitigation credible.

**Decision made:** ASCII architecture diagram rather than an image
file. It renders in GitHub, terminals, and git diffs, never breaks
on a path change, and can actually be reviewed in a pull request. A
polished diagram gets made separately for the report.

**Decision made:** No shields.io badges. Every badge is a live
request to a third-party service, and a broken badge looks worse
than none. Revisit at File 088 when CI actually exists.

**Commit:** `docs: add project README with architecture and setup`