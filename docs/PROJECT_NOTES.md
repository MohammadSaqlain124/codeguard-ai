# CodeGuard AI — Project Notes, ## Conventions, ## Entry template

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

## 2026-09-04 — Day 1 — File 002: .gitignore

**What we built:** The repository ignore list — ~65 patterns across
eleven groups covering secrets, Node and Python dependencies, build
output, ML checkpoints, Docker volume data, Android build artifacts,
editor state, and OS junk.

**Why we built it:** Git tracks everything by default. Three classes
of file must never enter history: secrets (once committed, they are
in history permanently — deleting them later does not remove them),
generated files (node_modules is ~40,000 files and regenerable from
package.json), and machine-local files (.DS_Store, Thumbs.db) that
describe one person's computer rather than the project. This is
File 002 because it has to exist before anything can generate a
file worth hiding.

**Why a separate file:** Git offers no alternative — the rules live
in a file named .gitignore. The real choice was one root file versus
one per directory. Root wins because the patterns overlap heavily
across apps/api, apps/detector, apps/web and harness; split files
drift until a secret leaks through the gap. It also means one place
to look when Git refuses to track something.

**Libraries introduced:** None. Declarative config read directly by
Git's path-matching engine. Syntax is glob patterns, not regex.

**Functions written:** None.

**Concepts learned:** glob pattern · character class · negation
pattern · anchored pattern · tracked vs untracked · staging area
(index) · working directory · hidden file · bytecode · virtual
environment · model checkpoint · .gitkeep convention

**Problem faced:** Wanted harness/generated/ present in the repo but
its contents ignored. Two obstacles: Git does not track empty
directories at all, and a negation pattern silently fails if the
parent directory itself was excluded.

**How we solved it:** Placed an empty .gitkeep inside the folder
(convention, not a Git feature, to give the directory a file), and
wrote `harness/generated/*` with a trailing /* rather than /. The
slash-star excludes the *contents* rather than the directory, so Git
still descends into it and the `!harness/generated/.gitkeep`
negation can take effect. Applied the identical fix to .vscode/*
so settings.json and extensions.json stay shared.

**Decision made:** Hand-wrote ~65 lines instead of using
gitignore.io. The generator produces ~400 correct lines, but every
one is a line I cannot explain in a viva. Ours is short enough to
defend entirely.

**Decision made:** Ignore ML checkpoints rather than using Git LFS.
Checkpoints are reproducible from ml/train.py with a fixed seed, so
they do not need versioning. LFS would add a setup step for every
teammate plus GitHub bandwidth quotas. The final model gets
distributed separately.

**Gotcha recorded:** .gitignore does not affect already-tracked
files. If something is committed and then ignored, Git keeps
tracking it. Fix is `git rm --cached <file>` — the --cached flag
removes it from tracking but leaves it on disk. Without the flag,
git rm deletes the real file.

**Commit:** `chore: add gitignore for secrets, deps and build artifacts`

## 2026-09-04 — Day 1 — File 003: docs/PROJECT_NOTES.md

**What we built:** The header for this log — purpose statement, five
conventions (append-only, one entry per file, date and file
numbering, revisits as new entries, commit prefixes) and the entry
template.

**Why we built it:** The log is the raw material for the report's
methodology, design-decisions and problems chapters, the answer
sheet for the viva, and dated proof that the project was built
steadily rather than assembled at the end. Without conventions
written down, entry quality drifts within a fortnight and the file
becomes unusable exactly when it is needed most.

**Why a separate file:** Distinct from README.md by time direction —
the README says what the project *is* and gets rewritten; this says
how it *became* that and is never edited. Distinct from git commit
messages by depth — a commit records what changed, not the
alternatives rejected or the hours lost. Distinct from the
handwritten notebook by audience — that one is mine, in my voice;
this one is the project's, read by teammates and examiners. Lives in
docs/ because the repo root is reserved for files tooling requires
there.

**Libraries introduced:** None.

**Functions written:** None.

**Concepts learned:** append-only record · engineering log ·
Conventional Commits · Architecture Decision Record (ADR) ·
git diff --stat · modified vs new file in git status

**Problem faced:** Deciding what happens when a past decision turns
out to be wrong. The instinct is to edit the old entry so the log
stays accurate.

**How we solved it:** Made append-only an explicit rule, including
for reversals. The original reasoning is exactly what the report's
design chapter needs — "we chose X for these reasons, discovered Y,
switched to Z" is a stronger narrative than only ever showing the
final answer. An edited log reads like it was written last week,
because effectively it was.

**Decision made:** Markdown in the repository rather than Notion or
Google Docs. It lives beside the code it describes, it is
version-controlled so entry timestamps are themselves evidence of
steady work, and it will still exist in 2027 when a Notion workspace
might not.

**Decision made:** One chronological file rather than one file per
day or grouping by subsystem. Grouping reads better but requires a
placement decision on every entry, and daily friction is how logs
die. Append to the bottom, zero decisions. Ctrl+F across one file
also beats searching 200.

**Decision made:** Fixed headings rather than free-form prose.
Free-form is faster and reliably omits the thing needed later. Fixed
headings force "Problem faced" and "Decision made" to be filled
every time — the two most valuable fields for the report.

**Commit:** `docs: add project notes header, conventions and entry template`