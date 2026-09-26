# CodeGuard AI — Project Notes

The engineering log for CodeGuard AI. One entry per file built, dated,
in the order it was built.

This is the raw material for the final report's methodology,
design-decisions and problems-encountered chapters. It is also the
answer sheet for the viva.

## Conventions

**Append-only.** New entries go at the bottom. Existing entries are
never edited, even when a decision is later reversed. If we change our
mind, we write a new entry saying so and why. The log is a history, not
a description of the present — that is what the README is for.

**One entry per file.** Every file gets an entry, including trivial
config files. If a file was worth creating it was worth a reason.

**Dated and numbered.** `YYYY-MM-DD — Day N — File NNN: path`. The file
number is the join key across this log, the notebook documents, and the
git history.

**Revisits get their own entry.** When we return to an existing file and
change it, that is a new dated entry headed `File NNN (revisit)`, not an
edit to the original.

**Commit prefixes.** `feat:` new capability · `fix:` bug fix ·
`docs:` documentation · `chore:` maintenance · `test:` tests ·
`refactor:` restructuring with no behaviour change.

## Entry template

```
## YYYY-MM-DD — Day N — File NNN: path/to/file

**What we built:**
**Why we built it:**
**Why a separate file:**
**Libraries introduced:**
**Functions written:**
**Concepts learned:**
**Problem faced:**
**How we solved it:**
**Decision made:**
**Commit:**
```

Omit a heading only when it genuinely does not apply — a config file has
no functions. Do not omit it because writing it is inconvenient.

---

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

## 2026-09-04 — Day 1 — File 004: .editorconfig

**What we built:** Cross-editor formatting rules — UTF-8, LF line
endings, final newline, trailing-whitespace trim, and 2-space
indentation as the baseline, with per-language overrides: 4 spaces
for Python and Kotlin, no whitespace trimming for Markdown, tabs for
Makefiles, CRLF for Windows script files.

**Why we built it:** Four people on three operating systems across
six languages. Without a shared rule, one teammate's editor
reformats a whole file on save and a one-line change appears as a
200-line diff — real work hidden in noise, and merge conflicts on
every line. Line endings are the sharper risk: our containers run
Linux, and a CRLF shell script fails inside one with
`bash: \r: command not found`, an error that says nothing about the
actual cause.

**Why a separate file:** The name is fixed by the EditorConfig
standard — every supporting editor looks for `.editorconfig`. It
does not replace Prettier or Ruff; it operates earlier and wider.
EditorConfig acts as you type, covers every file type including
Dockerfile, .env and Makefile that no formatter handles, and works
before anyone runs npm install. Root file rather than per-directory,
with `root = true` stopping the upward search, so the universal
rules are written once.

**Libraries introduced:** None. Declarative INI-format config read
by the editor, not by Git or any runtime. VS Code needs the
"EditorConfig for VS Code" extension — it has no native support,
which is the usual reason people think the file does nothing.

**Functions written:** None.

**Concepts learned:** EditorConfig · INI format · CRLF vs LF ·
character encoding · UTF-8 · PEP 8 · brace expansion in globs ·
tabs vs spaces · Makefile · formatter vs linter

**Problem faced:** Two file types break the universal rules.
Markdown uses two trailing spaces as significant syntax meaning
"line break," so trimming trailing whitespace silently deletes line
breaks — this already happened in our README, where the two lines
under the title collapsed into one paragraph. Makefiles require tab
indentation and fail with "missing separator" if given spaces.

**How we solved it:** Scoped overrides rather than weakening the
global rule. `[*.md]` sets trim_trailing_whitespace = false;
`[Makefile]` sets indent_style = tab. Same approach for Windows
script files — `[*.{bat,cmd,ps1}]` gets CRLF, because line endings
should match the platform that *executes* a file, not the one that
edits it.

**Decision made:** LF globally, rather than relying on Git's
core.autocrlf. autocrlf is a per-machine setting that cannot be
committed, so it has to be configured identically on four machines,
and it only governs what Git stores, not what the editor writes.
EditorConfig fixes it at the source.

**Known gap:** Neither fully solves line endings. The complete
answer is a .gitattributes file with `* text=auto eol=lf`, enforcing
it at the Git layer regardless of local config. Deferred until we
add shell scripts in infra/ (File 006), where it starts to matter.

**Decision made:** No max_line_length. EditorConfig can set it, but
line-length enforcement belongs to linters that understand the
language and can wrap intelligently. EditorConfig would only draw a
guide line.

**Commit:** `chore: add editorconfig for cross-platform formatting`

## 2026-09-04 — Day 1 — File 005: infra/.env.example

**What we built:** The committed template for every environment
variable the system needs — API port and CORS origin, MongoDB
credentials and connection URI, Redis host, MinIO credentials and
bucket, two JWT secrets with their expiries, the detector URL and
timeout, and upload limits. Real values live in infra/.env, which is
gitignored.

**Why we built it:** Secrets have to reach running code somehow.
Hardcoding puts them in git history permanently. A gitignored config
file alone leaves a new teammate with no idea what to create. The
template solves both — same keys, safe dummy values, committed. This
is the file the `!.env.example` negation in .gitignore existed for.
It doubles as documentation: the complete authoritative list of
every external service the system talks to.

**Why a separate file:** Separate from .env by design — same keys,
opposite git treatment. Separate from docker-compose.yml because
structure and config change at different rates; merging them means
every teammate edits the compose file locally and it stops being
mergeable. Separate from config/env.ts because this *supplies*
values while that *validates* them. Lives in infra/ because Docker
Compose automatically reads a file named .env from the directory
containing the compose file — a tooling requirement, not a
preference.

**Libraries introduced:** None here. Docker Compose reads .env
natively. Later: dotenv (npm) for running the API outside Docker,
chosen over dotenv-safe because Zod in File 009 handles validation
*and* type coercion; pydantic-settings on the Python side.

**Functions written:** None.

**Concepts learned:** environment variable · Twelve-Factor App ·
.env format · CORS · origin · connection string/URI · DNS ·
bucket · object storage · JWT · access vs refresh token ·
signing secret · MiB vs MB

**Problem faced:** Working out the right hostname for service-to-
service connections. The instinct is localhost, which is wrong
inside Docker.

**How we solved it:** Used the compose service names — mongo, redis,
minio, detector. Docker Compose runs an internal DNS server that
resolves each service name to its container IP. Inside a container,
localhost means *that container*, where nothing is listening. Getting
this wrong produces ECONNREFUSED 127.0.0.1:27017, which reads like
the database is down when actually we asked the wrong machine.

**Problem faced:** Every env value is a string. API_PORT=4000 yields
"4000", and MINIO_USE_SSL=false yields "false" — which is truthy in
JavaScript.

**How we solved it:** Accepted it here and deferred coercion to
File 009, where Zod parses and type-casts every variable at startup
and crashes loudly if one is missing or malformed.

**Decision made:** Two different JWT secrets rather than one. With a
shared secret, a leaked 15-minute access token could be replayed as
a 7-day refresh token. Separate secrets confine each token type to
its intended use.

**Decision made:** Plain .env over Docker secrets or Vault. Both are
correct for production and both are wrong here — Docker secrets need
Swarm mode, Vault is an entire service to run and learn, and our
spec already defers it. A .env file on a controlled single host is
appropriate for an academic deployment. Worth naming in the report's
limitations section.

**Decision made:** Dummy values like "changeme_mongo_password"
rather than empty values. Greppable — `Select-String -Pattern
changeme` instantly lists everything not yet replaced.

**Also learned:** ?authSource=admin in the Mongo URI tells MongoDB
which database holds the *user account*. The root user is created in
`admin` but we connect to `codeguard`. Without it, Mongo looks for
the user in the wrong place and returns an auth failure that says
nothing about the real cause.

**Commit:** `chore: add env template for all services`

## 2026-09-06 — Day 2 — File 006: infra/docker-compose.yml

**What we built:** The Compose definition for the data tier —
MongoDB 7, Redis 7 (Alpine, AOF persistence on) and MinIO. Each has
a pinned image, a fixed container name, restart policy, environment
variables substituted from infra/.env, a localhost-bound port
mapping, a named volume for persistence, and a healthcheck.

**Why we built it:** The project needs a database, a job queue and
object storage. Installing them natively means four teammates with
four subtly different environments and an examiner who cannot
reproduce the setup. Compose replaces all of that with one command
and gives byte-identical services on any machine with Docker. It is
also what makes the `mongo:27017` hostname in .env actually resolve.

**Why a separate file:** Separate from .env because structure and
values change at different rates — merged, every teammate edits the
compose file locally and it stops being mergeable. Separate from the
Dockerfiles by scope: a Dockerfile says how to build one image;
Compose says how services relate. In infra/ rather than the root so
deployment concerns stay together and because Compose reads .env
from the compose file's own directory — the reason File 005 lives
there. Cost is typing -f infra/docker-compose.yml, to be removed
later with a Makefile.

**Scope decision:** Only three services today, not five. The api and
detector services must be *built* from Dockerfiles that do not exist
yet, and Compose errors on a missing Dockerfile. Five services today
would be untestable. Revisit scheduled for File 014, once both
Dockerfiles exist.

**Libraries introduced:** No code libraries, but three images:
* `mongo:7` — document database. Chosen over PostgreSQL because
  detection results are deeply nested and layer-specific (matched
  subtree pairs, per-feature z-scores, token attributions), which is
  naturally a document. In Postgres that is either a jsonb column —
  Postgres imitating Mongo — or a dozen join tables. Counter-argument
  is real: Postgres gives true transactions and foreign keys, and the
  User/Course/Assignment relationships genuinely are relational.
* `redis:7-alpine` — in-memory store, used as the BullMQ job queue.
  Chosen over RabbitMQ because Redis is one container with no
  configuration, BullMQ is built on it, and we want Redis for caching
  anyway. One service instead of two.
* `minio:latest` — S3-compatible object storage. Chosen over the
  plain filesystem because the S3 API is what production uses, so
  moving to real S3 later is a config change rather than a rewrite,
  and because presigned URLs let a browser download a file directly
  without proxying through the API.

**Functions written:** None. Declarative YAML describing desired
state rather than steps.

**Concepts learned:** container · image · tag · Docker Hub ·
Compose service · named volume · bind mount · port mapping ·
healthcheck · YAML · variable substitution · AOF persistence ·
Alpine Linux · localhost binding · object storage / S3 API ·
presigned URL

**Problem faced:** Distinguishing a container that is *running* from
one that is *working*. MongoDB reports running within a second but
takes 10–20 seconds before it accepts connections. Without that
distinction, the API would start, try to connect and fail.

**How we solved it:** Added a healthcheck to every service — a
command Docker runs periodically to confirm the service actually
responds. start_period gives a grace window at boot where failures
do not count toward retries. At File 014 the api service will use
depends_on with condition: service_healthy so it waits properly.

**Problem faced:** `docker compose up` failed with "bind: Only one
usage of each socket address (protocol/network address/port) is
normally permitted" on port 27017. Redis and MinIO started; Mongo
did not.

**How we solved it:** Diagnosed rather than guessed.
`netstat -ano | findstr :27017` showed PID 5264 already LISTENING.
`netsh interface ipv4 show excludedportrange protocol=tcp` ruled out
a Hyper-V or WSL reserved range — exclusions were 50000–56066,
nowhere near 27017. `Get-Service MongoDB` confirmed a native MongoDB
Windows service, installed months earlier for a lab and starting
silently at boot. Fixed with `Stop-Service MongoDB` and
`Set-Service MongoDB -StartupType Manual`, keeping the install but
stopping it launching. Second obstacle: both commands failed with
"Access is denied" in a normal terminal. Reading service state is
unprivileged; changing it needs Administrator, and VS Code's
integrated terminal cannot elevate — it required a separate admin
PowerShell window. Lesson: two processes cannot own one port.
Diagnose netstat → PID → Get-Process before changing configuration.
The compose file was never wrong.

**Decision made:** Bound every port to 127.0.0.1 rather than the
default 0.0.0.0. Written as "27017:27017", Docker binds every
network interface, so anyone on the same college WiFi could reach
our MongoDB. The 127.0.0.1 prefix restricts it to this machine.
Ports are still exposed at all so MongoDB Compass and mongosh can
connect from Windows for debugging.

**Decision made:** Named volumes rather than bind mounts for data. A
bind mount would put the data in the project folder where it is
visible, but file permissions differ across Windows, Mac and Linux
and MongoDB is strict about ownership of its data directory. Named
volumes are managed by Docker and behave identically everywhere.

**Decision made:** Pinned images to a major version (mongo:7) rather
than :latest. With :latest, two teammates could silently run
different major versions months apart. Major-version pinning still
receives patch updates; pinning the full patch version would be
fully deterministic but means chasing security updates by hand.

**Decision made:** Enabled Redis AOF persistence with
--appendonly yes. Redis is in-memory by default, so a restart would
silently discard every queued detection job. AOF logs each write to
disk and replays it on restart.

**Known limitation:** Redis has no password. Acceptable because it
is bound to localhost and only reachable inside the Docker network,
but a production deployment would set --requirepass. Name this in
the report's limitations section.

**Security incident:** Live MinIO and MongoDB passwords were exposed
by pasting the output of `docker compose config` into a chat — that
command prints all resolved secrets. Rotated both and wiped the
volumes with `docker compose down -v`, which was free since no data
existed yet. Rule adopted: a secret's value never leaves the file it
lives in. Safe form of the command is
`docker compose config | Select-String -NotMatch "PASSWORD|SECRET"`.

**Verified working:** All three containers reported (healthy).
`db.adminCommand({ ping: 1 })` returned { ok: 1 } after
authenticating as codeguard against authSource admin.
`docker exec codeguard-redis ping -c 3 mongo` resolved the service
name to 172.18.0.4 — Docker's internal DNS demonstrated, which is
the mechanism behind the mongo:27017 hostname in .env. The
submissions bucket was created in MinIO and is PRIVATE.

**Still deferred:** The .gitattributes gap from File 004. This file
introduced no shell scripts, so LF enforcement at the git layer is
still not urgent. Trigger: the first .sh file added to infra/.

**Commit:** `feat(infra): add compose stack for mongo, redis and minio`

## 2026-09-06 — Day 2 — File 007: apps/api/package.json

**What we built:** The npm manifest for the API tier — scoped name
@codeguard/api, private flag, ESM declaration, Node >=22 engine
requirement, and five scripts (dev, build, start, typecheck, test).
Dependencies added by npm install rather than written by hand:
express and zod as runtime deps; typescript, tsx, @types/express,
@types/node and vitest as devDependencies.

**Why we built it:** Nothing in Node works without it. It records
dependencies so a teammate's npm install reproduces our exact tree;
it defines commands so nobody has to remember "tsx watch
src/server.ts"; its mere presence marks the directory as a Node
package and tells Node whether files are ESM or CommonJS; and it is
the input to Docker layer caching — the Dockerfile copies it before
the source so editing a .ts file does not re-run a two-minute
install.

**Why a separate file:** The name is fixed by npm. The real decision
was per-app rather than one manifest at the repo root. Root was
rejected on three grounds: the API's Docker build would install the
entire React toolchain it never executes; a single manifest would
let backend code import a frontend-only package, which installs fine
and crashes at runtime; and the API and web tiers could not version
a shared library independently during a migration.

**Libraries introduced:**
* `express` — minimal web framework. Chosen over Fastify (roughly 2x
  faster, but our bottleneck is tree edit distance in Python, not
  HTTP parsing in Node — optimising the fast part is the wrong
  instinct) and over NestJS (imposes a large framework to learn and
  defend; Express is small enough to understand completely).
* `zod` — runtime schema validation. Needed because TypeScript types
  vanish at compile time and check nothing at runtime, while every
  request body from the internet is untrusted. Chosen over Joi
  because Zod is TypeScript-first: one schema gives both runtime
  validation and the compile-time type via z.infer.
* `typescript` — the compiler.
* `tsx` — runs TypeScript directly with watch mode. Chosen over
  ts-node, which struggles with ESM configuration; tsx is built on
  esbuild and handles ESM with no configuration.
* `vitest` — test runner. Chosen over Jest because we picked ESM and
  Jest's ESM support has been experimental for years. Vitest is
  ESM-native and API-compatible with Jest.

**Functions written:** None. JSON data.

**Concepts learned:** npm · package · registry · manifest ·
dependency vs devDependency · semantic versioning · caret range ·
scoped package · ES Modules vs CommonJS · lockfile · transitive
dependency · DefinitelyTyped and @types · hot reload · type checking
vs transpiling

**Problem faced:** Whether to write the full eventual dependency
list now or add libraries as they are needed.

**How we solved it:** Added only what the first server file
requires. Two reasons. Writing version numbers by hand risks
specifying a version that does not exist, whereas npm install writes
the real current one — and the actual resolved versions (Express
5.2, Zod 4.5, TypeScript 7.0) were all newer than expected. And the
notebook gets one page per library at first use; fifteen pages today
would mean defending choices in a viva for packages never touched.

**Problem faced:** `git add apps/api/package.json` failed with
"pathspec did not match any files" despite the file existing.

**How we solved it:** The terminal was inside apps/api, and git
resolves paths relative to the current directory — so it looked for
apps/api/apps/api/package.json. The `../` shown in git status was
the tell. Habit adopted: run every git command from the repository
root.

**Version notes for later:** Express 5, not 4. In Express 4 an async
handler that throws crashes the process, which is why tutorials wrap
handlers or install express-async-errors. Express 5 forwards
rejected promises to the error handler automatically, so that
wrapper is unnecessary. Also app.del() is removed (use app.delete())
and wildcard routes are /*splat rather than /*. Zod 4, not 3: the
API is unchanged, but a ZodError exposes .issues, not .errors —
relevant when the error handler is written.

**Decision made:** ESM ("type": "module") rather than CommonJS. ESM
is the standard, matches the React frontend, and supports top-level
await. The cost is a rule that looks like a bug: an import of a .ts
file must be written with a .js extension, because TypeScript
refuses to rewrite import paths and the ESM spec requires an
explicit extension, so the path must name the compiled output.

**Decision made:** npm rather than pnpm or yarn. pnpm is faster and
more disk-efficient; yarn has better workspace support. npm ships
with Node, so there is zero setup for four teammates, and every
tutorial assumes it. Not worth spending complexity budget on a
package manager.

**Decision made:** No npm workspaces yet. They are the right tool for
packages/shared-types later. With one package and nothing shared,
adding them now would be structure for its own sake.

**Decision made:** Commit package-lock.json. It records the exact
resolved version of all 123 packages including transitive ones, so a
teammate's install produces an identical tree. Without it they could
get a newer transitive dependency carrying a bug we cannot
reproduce.

**Commit:** `feat(api): add package manifest with express, zod and typescript toolchain`

## 2026-09-06 — Day 2 — File 008: apps/api/tsconfig.json

**What we built:** The TypeScript compiler configuration for the API
tier — ES2023 target and lib, NodeNext module resolution, src to
dist paths, strict mode, verbatimModuleSyntax, consistent filename
casing, source maps, skipLibCheck and resolveJsonModule.

**Why we built it:** TypeScript is not a runtime — Node cannot
execute a .ts file. Something has to say which files to compile,
which JavaScript version to emit, which module system to use and how
strict to be. It is also what makes the editor useful: VS Code's
language server reads this file, so without it there is no
autocomplete on Express objects and no error highlighting.

**Why a separate file:** The name is fixed by tsc. TypeScript
deliberately does not allow config inside package.json, unlike Jest
or ESLint, because tsconfig supports `extends` — we will likely want
apps/api and apps/web sharing strictness while differing on target
and module, which is impossible if the config is buried in a
manifest. Conceptually: package.json says what to install and which
commands exist; tsconfig says how to compile. Per-app rather than
root because the API targets Node with no DOM and Node-style
resolution, while the frontend targets a browser with DOM types, JSX
and bundler resolution — genuinely incompatible option sets.

**Ordering correction:** The original plan put the Dockerfile at 008.
That was wrong — a Dockerfile packages an application, and ours did
not exist yet. Its build step runs tsc, which needs this file and a
non-empty src/. Corrected order: 008 tsconfig, 009 config/env.ts,
010 app.ts, 011 server.ts, 012 Dockerfile, 013 .dockerignore.
Phase 0 grows from 14 files to 16.

**Libraries introduced:** None imported, but two from File 007 are
governed here. `typescript` provides tsc and the language server
VS Code uses. `@types/node` is what "types": ["node"] refers to —
without it, process.env, Buffer and every Node built-in would be
undefined types.

**Functions written:** None. Declarative JSON.

**Concepts learned:** transpilation · type erasure · target vs lib ·
strict mode · strictNullChecks · noImplicitAny · any · source map ·
declaration file (.d.ts) · language server · type-only import ·
glob **

**Problem faced:** tsx transpiles one file at a time, so it cannot
tell whether an imported name is a type or a value. An import of a
type-only name would survive into the output and fail at runtime
when Node tries to import something that does not exist as a value.

**How we solved it:** Enabled verbatimModuleSyntax, which forces the
distinction to be explicit — `import type { Request } from 'express'`
for types, plain `import express from 'express'` for values. Type
imports are then guaranteed to be erased.

**Decision made:** strict: true from the start rather than tightening
incrementally. Strictness is only cheap before code exists;
retrofitting means fixing hundreds of errors at once, which is how
projects end up leaving it off permanently.

**Decision made:** NodeNext rather than moduleResolution "Bundler".
Bundler is more forgiving and needs no .js extensions, but it is
correct only when a bundler processes the output afterwards. The API
has no bundler — Node loads the files directly — so Bundler would
emit imports Node cannot resolve, failing at runtime instead of
compile time. apps/web will legitimately use Bundler because Vite
handles resolution there.

**Decision made:** No "DOM" in lib. Makes document.getElementById a
compile error on the server. Costs nothing, prevents writing
browser-only code that type-checks and crashes in a container.

**Decision made:** No noUncheckedIndexedAccess. It catches real
index-out-of-bounds bugs but makes ordinary loops noticeably more
annoying, and readable defensible code matters more here.
Reconsider if such a bug actually appears.

**Confirmed working:** A scratch file with an untyped parameter
produced TS7006 "implicitly has an 'any' type" and compiled cleanly
once annotated — strict mode is genuinely active, not just
configured.

**Commit:** `feat(api): add typescript config with strict mode and NodeNext modules`

## 2026-09-07 — Day 3 — File 009: apps/api/src/config/env.ts

**What we built:** The first real TypeScript in the project — a Zod
schema covering all 22 environment variables the API uses, parsed
once at startup with safeParse. On failure it prints one readable
line per problem and exits with code 1. On success it exports a
single typed `env` object.

**Why we built it:** Environment variables have three properties
that make them dangerous used raw. Every value is a string, so
API_PORT is "4000" and MINIO_USE_SSL is "false" — which is truthy in
JavaScript, so `if (process.env.MINIO_USE_SSL)` silently takes the
wrong branch. Every value might be undefined, so a typo like
MONGO_URl produces undefined and a connection error that says
nothing about the typo. And failures surface late — a missing JWT
secret is discovered at the first login, not at startup. This file
fixes all three: validate at startup, crash loudly, export one typed
object. Fail fast — a container that refuses to start with a clear
message beats one that starts and fails unpredictably an hour later.

**Why a separate file:** Separate from infra/.env by role, which was
claimed at File 005 and is now demonstrated — that file *supplies*
values, this one *validates and types* them. Separate from
server.ts because this is a leaf module: it imports Zod and nothing
from our own code, so any file can import it without risking a
circular dependency. If validation lived in server.ts, then
storageService needing MINIO_BUCKET would import server.ts, which
imports app.ts, which imports the service. In config/ rather than
loose in src/ because logger.ts and constants.ts are coming.

**Libraries introduced:** No new packages. Zod (from File 007) is
used here for the first time: z.object for shape, z.coerce.number
for string-to-number, .transform for string-to-boolean and
string-to-array, .refine for the cross-field rule, .safeParse for
non-throwing validation, and .issues to read failures. Considered
envalid and dotenv-safe, which are purpose-built for env validation,
and rejected both — they would be a second validation library
alongside Zod, which we need anyway for request bodies.

**Functions written:** No named functions. Three arrow functions
passed to Zod: the MINIO_USE_SSL transform (string to boolean), the
ALLOWED_EXTENSIONS transform (comma string to trimmed lowercase
array), and the refine predicate comparing the two JWT secrets. The
module body itself runs once on import — a deliberate side effect on
import, so validation happens before any other code regardless of
which file imports it first.

**Concepts learned:** schema · validation · coercion · transform ·
refinement · fail fast · exit code · stdout vs stderr · control-flow
narrowing · never type · truthiness · entropy · side effect on
import · leaf module · circular import

**Problem faced:** MINIO_USE_SSL="false" is truthy. Coercing with
z.coerce.boolean() would not help — Boolean("false") is true.

**How we solved it:** z.enum(["true","false"]).transform(v => v ===
"true"). The enum validates the *input* is one of those exact
strings, so "yes", "1" and "TRUE" fail loudly instead of being
misread; the transform then produces a real boolean. Input type is
string, output type is boolean — that asymmetry is the mechanism.

**Problem faced:** Field-level rules cannot express a relationship
between two fields, but the File 005 decision requires the two JWT
secrets to differ.

**How we solved it:** .refine() on the object, which runs after all
fields validate and receives the whole object, with
path: ["JWT_REFRESH_SECRET"] so the error attaches to a named field.
The design decision is now enforced by code rather than merely
documented.

**Decision made:** safeParse rather than parse. parse throws, and an
uncaught Zod error prints a large unreadable JSON blob. safeParse
lets us print one line per problem — and, importantly, control what
is printed. If this dumped process.env on failure, our JWT secrets
would land in container logs, which Docker stores on disk and CI
systems often publish. Only field names and messages are printed,
never values.

**Decision made:** Crash rather than fall back to defaults. The
tempting alternative is `process.env.API_PORT || 4000`, which is
fine for a port and catastrophic for a secret —
`JWT_ACCESS_SECRET || "dev-secret"` in production means anyone
reading the source can forge admin tokens. Rather than reason
case-by-case, only genuinely optional variables get .default(), and
secrets never do.

**Decision made:** Left MONGO_ROOT_USER and MONGO_ROOT_PASSWORD out
of the schema. They are consumed by the MongoDB container to create
its admin account; the API never uses them, since its credentials
are embedded in MONGO_URI. Validating unused variables would
misrepresent what this service actually needs.

**Decision made:** Node's built-in --env-file rather than the dotenv
package. Node has loaded .env files since 20.6, so the dependency is
unnecessary, and it keeps this file pure — it validates process.env
without caring how the values arrived, so it behaves identically in
Docker (where Compose injects them) and locally.

**Zod 4 note confirmed:** a ZodError exposes .issues, not .errors.
Every Zod 3 tutorial uses .errors, which does not exist in Zod 4.

**Confirmed working:** env.API_PORT printed as `4000 number`, not a
string — coercion proven. env.MINIO_USE_SSL printed as
`false boolean`. env.ALLOWED_EXTENSIONS printed as an array.
Running without --env-file listed every missing variable at once,
printed no values, and exited with code 1. Setting both JWT secrets
to the same value produced the refine error.

**File 007 revisit:** the dev script became
`tsx watch --env-file=../../infra/.env src/server.ts`.

**Commit:** `feat(api): validate and type environment config with zod`

## 2026-09-07 — Day 3 — File 010: apps/api/src/app.ts

**What we built:** The Express application factory — createApp()
registers security headers (helmet), CORS from config, JSON body
parsing with a 100kb limit, a liveness /health endpoint, and a
JSON 404 catch-all, then returns the app.

**Why we built it:** This is the object that turns an HTTP request
into a response. It is where config, middleware and routes come
together.

**Why a separate file:** An Express app is not a server. The app is
a function — request in, response out. A server is a process bound
to a TCP port. Keeping them apart is what makes the API testable:
supertest can run the entire pipeline (middleware, routing, JSON
parsing) against createApp() without binding a port, so tests need
no cleanup and can run in parallel. Combined, importing the module
would start a real listener, two test files would collide on port
4000, and CI would fail intermittently. Also separate from route
files — this assembles, they define endpoints, so adding a route
never means editing a 300-line app.ts.

**Libraries introduced:**
* `helmet` — sets a bundle of HTTP security headers. Browsers only
  enable several protections when the server asks; helmet asks, in
  one line. Chosen over setting headers by hand because that means
  knowing all fifteen and tracking browser changes. The two that
  matter most here: X-Content-Type-Options: nosniff (stops browsers
  guessing a response's type) and X-Frame-Options: DENY (blocks
  clickjacking via iframe embedding).
* `cors` — implements Cross-Origin Resource Sharing. Our frontend
  runs on :5173 and the API on :4000; different ports are different
  origins, so the browser blocks requests unless the API sends
  Access-Control-Allow-Origin. Passed env.CORS_ORIGIN rather than
  origin: true, which reflects any origin and effectively permits
  everyone.
* `@types/cors` — DefinitelyTyped definitions. helmet ships its own
  types; cors does not.

**Functions written:**
* `createApp()` — builds and returns a configured Express app.
  Registers middleware in order, then routes, then the 404. Takes
  nothing, returns an Express application object. Cannot fail at
  call time; it only registers handlers.
* Health handler `(_req, res)` — responds { status, uptime } with
  200 via res.json(), which also sets Content-Type.
* 404 handler `(_req, res)` — responds { error: "Not found" } with
  404. Registered last, with no path, so it matches anything that
  reached it unmatched.

**Concepts learned:** middleware · middleware chain · factory
function · HTTP method · route · status code · Request/Response
objects · body parser · security headers · clickjacking · MIME
sniffing · Content Security Policy · preflight request · liveness vs
readiness · denial of service · arity

**First real use of the .js extension rule:** `import { env } from
"./config/env.js"` — the file on disk is env.ts. TypeScript refuses
to rewrite import paths, and ESM requires an explicit extension, so
the source names the compiled output. Package imports (express,
helmet, cors) take no extension because they resolve through
node_modules rather than as relative paths.

**Problem faced:** Deciding whether /health should check MongoDB and
Redis.

**How we solved it:** Kept it liveness-only. Liveness answers "is
the process alive?" and the response to failure is a restart.
Readiness answers "can it serve real traffic?" and the response is
to stop routing requests to it. If /health checked MongoDB, a brief
database blip would fail Docker's healthcheck, restart the API,
drop every in-flight request, and not fix MongoDB. A separate
/health/ready that does check dependencies comes at File 015.

**Decision made:** Factory function rather than a module-level app.
A shared instance means one test's mutation leaks into the next and
failures depend on file ordering. A factory gives each test a clean
instance for one line.

**Decision made:** Named export rather than default. Renaming
createApp then breaks every import visibly at compile time. With a
default export each importer picks its own name, so a rename
silently produces inconsistent naming.

**Decision made:** JSON body limit written explicitly at 100kb even
though it matches Express's default. It changes nothing today, but
it makes the number a decision rather than an accident. Note this is
not the file upload limit — MAX_UPLOAD_BYTES (1 MiB) governs
multipart uploads handled by multer at File 038. Different body
type, different middleware, different limit.

**Learned about middleware order:** registration order is execution
order. Helmet before routes so every response including errors gets
the headers; CORS before routes so preflight OPTIONS requests are
answered without reaching handlers; express.json before routes so
req.body is populated by the time a handler sees it. Putting
express.json after the routes leaves req.body undefined everywhere
with no error explaining why.

**Learned about CORS:** it is enforced by the *browser*, not the
server. curl, Postman and our Android app ignore it entirely. It is
not authentication — it only stops a malicious website making
requests as a logged-in user. Frequently misunderstood as a security
boundary.

**Not yet built:** the error handler. Express identifies error
middleware by arity — four parameters (err, req, res, next) instead
of three. That comes at File 026 with the typed AppError class.
Until then an unhandled error produces Express's default 500 with a
stack trace: acceptable now, unacceptable in production.

**Commit:** `feat(api): add express app with security middleware and health endpoint`

## 2026-09-07 — Day 3 — File 011: apps/api/src/server.ts

**What we built:** The process entry point — binds createApp() to
env.API_PORT, captures the returned http.Server, and manages the
process lifecycle: SIGTERM and SIGINT handlers that drain in-flight
requests before exiting, a 10-second force-exit timer, a guard flag
against double shutdown, closeIdleConnections() to release
keep-alive sockets, and last-resort handlers for unhandled
rejections and uncaught exceptions.

**Why we built it:** Two jobs. Binding the port is trivial. Shutting
down without dropping requests is not, and it is what most student
projects skip. Docker sends SIGTERM to stop a container, and Node's
default response is to exit immediately — so a submission being
uploaded at that moment has its TCP connection severed mid-transfer.
The browser gets ERR_CONNECTION_RESET with no status code and
nothing the frontend can handle, and a request midway through a
MongoDB write may leave a half-written document. Matters more later:
the BullMQ worker will be mid-detection on restart, and without
clean shutdown that job is neither completed nor requeued.

**Why a separate file:** An Express app is a function; a server is a
process. Keeping them apart lets supertest run the whole request
pipeline against createApp() with no port bound. There is a second
reason specific to this file: signal handlers, process.exit and port
binding are process-level concerns that must run exactly once. In
app.ts, every test import would register another set of handlers and
Node warns about listener leaks after ten.

**Libraries introduced:** None. All Node built-ins. `process` is a
global (no import) used for process.on and process.exit.
setTimeout/clearTimeout — note Node's setTimeout returns a Timeout
*object*, not a number as in browsers, which is one reason
@types/node matters. http.Server comes from app.listen(); .close(),
.closeIdleConnections() and .keepAliveTimeout belong to it, not to
Express.

**Functions written:**
* `shutdown(signal)` — guard flag, force-exit timer, server.close()
  with callback, closeIdleConnections(). Takes the signal name for
  logging only; returns nothing because it terminates the process.
  Failure modes: close() errors if not listening (exit 1), drain
  exceeds 10s (force exit 1), called twice (second call returns).
* The listen callback — logs port and mode once the socket is bound.
* Four process.on handlers — thin wrappers, except uncaughtException
  which exits directly.

**Concepts learned:** entry point · signal (SIGTERM/SIGINT/SIGKILL) ·
graceful shutdown · draining · idempotent · keep-alive · TCP socket ·
event loop · exit code · unhandled rejection · uncaught exception ·
numeric separator · orchestrator

**Key realisation:** app.listen() returns the Node http.Server, and
most tutorials discard it. Capturing it is the entire prerequisite
for graceful shutdown — the Express app itself has no close method.

**Problem faced:** server.close() does not close existing
connections; it stops accepting new ones and waits for current ones
to end. HTTP keep-alive means a browser may hold an idle-but-open
connection for up to 60 seconds, so Ctrl+C appeared to hang and then
force-exited after 10 seconds with nothing actually wrong.

**How we solved it:** server.closeIdleConnections() (Node 18.2+),
called after server.close(). It closes connections with no request
in flight while leaving active ones alone, so the drain finishes
immediately when nothing is actually being served.

**Problem faced:** If a single request hangs, server.close() never
completes and the process never exits. Docker waits out its
stop_grace_period and then sends SIGKILL — exactly the ungraceful
termination we were avoiding.

**How we solved it:** A 10-second force-exit timer, cleared in the
close callback. Set slightly at Docker's default grace period so we
control our own exit rather than having the platform impose one. If
shutdowns are ever killed, raise stop_grace_period in compose rather
than lowering this. Also: clearTimeout must be called, or the
pending timer keeps the event loop alive and the "clean" shutdown
hangs anyway.

**Decision made:** uncaughtException exits immediately rather than
shutting down gracefully, unlike unhandledRejection. After an
uncaught exception the process is in an unknown state — some code
stopped partway, an assumption was violated — so continuing to run,
even to drain requests, risks corrupting data. An unhandled
rejection usually just means a forgotten .catch() and the process is
probably fine, so draining is safe.

**Decision made:** No process manager (PM2, forever). Docker already
provides restart policies and log collection, and running a process
manager inside a container means two supervisors disagreeing about
lifecycle. One supervisor per process.

**Decision made:** No clustering. Node's cluster module forks one
process per core, but our CPU-heavy work is in the Python detector,
not here, and Compose can scale replicas if needed.

**Deferred:** keepAliveTimeout tuning. Node's HTTP keep-alive
timeout is 5s, and a reverse proxy with a longer idle timeout can
produce sporadic 502s when the two disagree. Real problem, but only
behind Nginx, which is deferred. Trigger for revisiting: when Nginx
is added.

**Known temporary state:** console.log rather than a structured
logger. pino arrives at File 027; swapping is a two-line change.
Noted so it reads as a decision, not an oversight.

**Platform note:** Windows has no real POSIX signals. Node emulates
SIGINT for Ctrl+C, so that path is testable locally, but SIGTERM
will not fire on Windows — and SIGTERM is what Docker sends. The
handler is untestable on this machine and correct in the environment
that matters.

**Commit:** `feat(api): add server entry point with graceful shutdown`

## 2026-09-07 — Day 3 — File 012: apps/api/Dockerfile

**What we built:** A two-stage Docker build for the API. The build
stage installs all dependencies and runs tsc; the runtime stage
starts from a clean base, installs production dependencies only,
copies dist/ from the build stage, drops to the non-root node user,
and runs `node dist/server.js` in exec form.

**Why we built it:** The API currently runs only because this
machine has Node 22, the right packages and a working tsx. The image
carries its own runtime, so it reproduces identically anywhere,
deploys as a single artifact, and runs isolated from the host. It is
also what unblocks File 014's compose revisit — the missing
Dockerfile is why File 006 shipped with three services instead of
five.

**Why a separate file:** A Dockerfile describes how to build one
image; Compose describes how services relate. Recipe versus seating
plan. It lives in apps/api rather than infra/ because of build
context — Docker can only COPY files inside the context, so placing
it beside the code makes the context exactly apps/api, and a
frontend change cannot invalidate the API's build cache.

**Libraries introduced:** No packages. Base image
node:22-bookworm-slim (Debian 12, stripped of docs and extras) for
both stages. Docker BuildKit is the build engine, default since
Docker 23 — it handles layer caching and parallel stage execution.

**Functions written:** None. Declarative build instructions; each one
produces a layer.

**Concepts learned:** Dockerfile · image vs container · layer ·
layer cache · build context · multi-stage build · base image ·
exec form vs shell form · PID 1 · WORKDIR · EXPOSE · non-root user ·
attack surface · defence in depth · deterministic build ·
musl vs glibc · distroless

**Key mechanism — layer caching:** every filesystem-changing
instruction creates a layer, and Docker reuses a cached layer only
if that instruction and everything before it is unchanged. So
package.json and package-lock.json are copied and installed *before*
the source. The naive `COPY . .` then `npm ci` would invalidate the
install layer on every source edit and reinstall 127 packages every
build — two minutes instead of ten seconds.

**Decision made:** bookworm-slim rather than alpine. At File 006 we
used alpine for Redis and noted the risk would land on application
images; this is where it lands. Alpine uses musl instead of glibc,
and native modules — packages with compiled C++ — often ship
prebuilt binaries only for glibc. bcrypt arrives at File 028, and on
alpine npm would fall back to compiling from source, requiring
python3, make and g++ in the image. Sizes: alpine ~50MB, slim ~80MB,
full node:22 ~400MB. Not worth 30MB for a build toolchain and a
class of confusing errors.

**Decision made:** Multi-stage rather than single-stage. Single-stage
would ship TypeScript, Vitest, all 127 packages and the .ts source
in production — roughly 450MB versus 200MB, with a compiler and test
runner sitting in the production image. Four extra lines.

**Decision made:** npm ci rather than npm install. ci reads the
lockfile rather than package.json, installs exactly the locked
versions, deletes node_modules first, and errors if the lockfile is
out of sync instead of silently updating it. Deterministic images —
the reason File 007 committed the lockfile.

**Decision made:** npm cache clean --force in the *same* RUN as the
install. Each RUN is a layer, and a layer records changes; deleting
the cache in a later RUN leaves the files in the earlier layer and
the image does not shrink. Cleaning in the same instruction means
the cache never lands in a layer at all. About 50MB.

**Decision made:** USER node rather than the default root. Root in a
container plus a container-escape vulnerability means root on the
host. Placement matters — it comes after the COPY and RUN
instructions, which need root to write to /app.

**Decision made:** Not distroless. Google's distroless images have
no shell, so an attacker with remote code execution has no shell to
use — genuinely more secure, and it also means we cannot docker exec
in to debug. Wrong trade for a project we will be debugging for
eleven months. Name as future work in the report.

**Decision made:** Healthcheck stays in compose rather than in this
file. Keeps all service healthchecks in one place and lets the
interval change without rebuilding the image.

**Critical connection to File 011:** CMD is in exec form —
["node", "dist/server.js"] — not shell form. Shell form wraps the
command in /bin/sh -c, making sh PID 1 and node a child. docker stop
sends SIGTERM to PID 1, and sh does not forward signals, so the
Node handlers never fire and Docker eventually SIGKILLs. Exec form
makes node PID 1 and the signal arrives directly. This is the same
class of problem as the tsx watch issue — a supervisor sitting
between the signal source and the process. Note also that PID 1 in
Linux gets no default signal handlers, so this only works because
File 011 registers explicit ones; the fallback for images without
them is init: true in compose.

**Confirmed working:** Rebuild after a source edit showed CACHED on
the npm ci step and completed in seconds. Image size ~200MB.
`docker run whoami` returned node, not root. `ls /app` showed dist
but no src and no tsconfig.json, proving the multi-stage discard.
`docker stop` produced "SIGTERM received, closing server" followed
by "shutdown complete" — the graceful shutdown path that could not
be tested locally under tsx watch now verified in the environment
that actually matters.

**Known cosmetic inconsistency:** API_PORT is configurable via env
but EXPOSE 4000 is hardcoded. EXPOSE is documentation only and
publishes nothing, so the mismatch has no functional effect.

**Next file motivated by this one:** the build context currently
includes node_modules, roughly 200MB sent to the daemon before the
build even starts. File 013 (.dockerignore) fixes it.

**Commit:** `feat(api): add multi-stage dockerfile with non-root runtime`

## 2026-09-10 — Day 4 — File 013: apps/api/.dockerignore

**What we built:** The build-context exclusion list for the API
image — node_modules, dist, .env and variants, .git and build
metadata, markdown, tests, coverage, editor directories, and OS
junk.

**Why we built it:** Docker sends a build context to the daemon
before building, and COPY can only reach files inside it. Three
things must stay out: secrets (a .env baked into a layer is
retrievable by anyone who pulls the image, and deleting it in a
later layer does not remove it — the same permanence problem as git
history), host-specific artifacts (node_modules was installed on
Windows; native modules compiled for Windows fail inside a Linux
container with cryptic loader errors), and noise like .git, which is
tens of megabytes of history the application never reads and which
contains every version of every file ever committed.

**Correction to File 012's reasoning:** I expected the first build
to be slow with a huge context and used that to motivate this file.
The actual build was 14.5 seconds with "transferring context:
105.60kB" — BuildKit only transfers files a COPY instruction
actually references, so node_modules was never sent. That
motivation was wrong. The reasons that survive: this is a
correctness guard rather than a speed optimisation, and it makes a
future `COPY . .` harmless instead of dangerous. Honest assessment —
a ~20-line insurance policy, not a performance fix.

**Why a separate file:** The name is fixed and it must sit at the
build context root, which for us is apps/api — a root-level
.dockerignore would be ignored entirely. It cannot reuse .gitignore
because they answer different questions and diverge on exactly the
entries that matter: .gitignore *tracks* Dockerfile and README.md as
source, while .dockerignore *excludes* them as build metadata with
no runtime value. Docker has no option to read .gitignore. The
detector gets its own at File 016 — two build contexts, two files.

**Libraries introduced:** None. Read by the Docker CLI, at the CLI
layer, before anything reaches the daemon — which is why an excluded
file is genuinely unreachable rather than merely blocked.

**Functions written:** None. A pattern list.

**Concepts learned:** build context · Docker daemon vs CLI ·
denylist vs allowlist · native module · anchored pattern

**Syntax difference from .gitignore:** Docker uses Go's
filepath.Match. Patterns are anchored to the context root by
default, whereas a slashless .gitignore pattern matches at any
depth. Trailing slashes carry no extra meaning.

**Decision made:** Denylist rather than `*` plus negations. The
allowlist form is maximally safe against leaks and means every new
file requires editing this file first — the same trade rejected at
File 002.

**Decision made:** No `!` negations at all. .gitignore needed one for
.env.example; nothing here needs re-including, and negations are a
known source of silent failure, as found at File 002 with
harness/generated.

**Decision made:** Excluded the Dockerfile itself. It is needed to
build but not to run, and shipping build metadata inside a runtime
image is the same instinct as dropping to a non-root user — ship the
minimum.

**Confirmed working:** Added a temporary `COPY .env ./` to the
Dockerfile with a real apps/api/.env present. The build failed with
"failed to compute cache key: /.env: not found" — the file exists on
disk but was never sent to the daemon, so COPY genuinely could not
find it. That failure is the proof. Also confirmed the image's
node_modules has ~65 entries rather than the local 127, since the
runtime stage installs with --omit=dev.

**Commit:** `chore(api): add dockerignore to keep secrets and host artifacts out of images`

## 2026-09-10 — Day 4 — File 014: apps/detector/pyproject.toml

**What we built:** The Python project manifest — project metadata,
requires-python >=3.11, runtime dependencies (fastapi,
uvicorn[standard], pydantic, pydantic-settings), a dev extras group
(pytest, httpx, ruff), hatchling as build backend, and inline
configuration for ruff and pytest. Plus a generated requirements.txt
lockfile.

**Why we built it:** The same four jobs package.json does on the Node
side — declare dependencies so teammates get an identical set,
declare the Python version so pip refuses an incompatible one with a
clear message, make our code importable so `from app.config import
settings` works regardless of the launch directory, and hold tool
configuration in one place instead of .ruff.toml plus pytest.ini.

**Why a separate file:** The name is fixed by PEP 518. Separate from
apps/api/package.json for the reasons File 007 rejected a root
manifest, except the languages make it absolute: the API image must
not install PyTorch and the detector image must not install React.

**Why not requirements.txt as the manifest:** It is a pip convention
rather than a standard, has no project metadata, no dev/prod split
without a second file, no tool config, and cannot make code
importable. pyproject.toml is what the packaging ecosystem
converged on (PEP 518/621). We still generate a requirements.txt —
but as a *lockfile* from pip freeze, which is a different job.

**Libraries introduced:**
* `fastapi` — async web framework. Validates request bodies from
  Pydantic models automatically and generates interactive OpenAPI
  docs at /docs from type hints alone. Chosen over Flask (no async,
  no automatic validation, no OpenAPI) and Django (a full ORM and
  admin framework for a service that only receives code and returns
  scores).
* `uvicorn[standard]` — the ASGI server that actually runs FastAPI.
  Same app-versus-server split as app.ts and server.ts. The
  [standard] extras pull uvloop and httptools for real speed gains;
  without the brackets you get a slower pure-Python implementation.
* `pydantic` — runtime validation driven by type hints. Pydantic is
  to Python what Zod is to TypeScript — different mechanism, same
  purpose.
* `pydantic-settings` — the direct counterpart to config/env.ts.
  Same fail-fast design in half the code, because Pydantic handles
  coercion natively.
* `pytest` — test runner. Plain assert statements and a real fixture
  system, versus unittest's Java-derived self.assertEqual ceremony.
* `httpx` — HTTP client. FastAPI's TestClient is built on it, so
  testing endpoints requires it. The counterpart to supertest.
* `ruff` — linter and formatter in Rust, roughly 100x faster,
  replacing flake8, isort, pyupgrade, pylint and black with one
  binary.

**Functions written:** None. Declarative TOML.

**Concepts learned:** TOML · PEP · virtual environment · editable
install · extras · build backend · ASGI vs WSGI · linter vs
formatter · transitive dependency · lockfile · mutable default
argument

**Ruff rules chosen:** E (pycodestyle), F (pyflakes), I (isort),
UP (pyupgrade), B (bugbear). B is the valuable one — it catches
mutable default arguments like `def process(items, results=[])`,
where the list is created once at definition and shared across every
call. Deliberately not enabling all of ruff's hundreds of rules; an
over-strict linter gets disabled rather than obeyed.

**Decision made:** line-length 100 rather than the community default
88 (inherited from black). ML code has genuinely long lines that do
not wrap gracefully.

**Decision made:** pip rather than Poetry or uv. Poetry gives proper
dependency resolution and a real lockfile, and uv is dramatically
faster and produces a cross-platform lock. Both rejected because pip
ships with Python — zero setup for four teammates — and every
tutorial assumes it. Same reasoning as npm over pnpm at File 007.
Noted: if pip install becomes painful when PyTorch arrives at
Tier 3, uv is the upgrade, and it reads the same pyproject.toml so
switching costs nothing.

**Honest limitation:** pip has no real lockfile. We generate one with
`pip freeze --exclude-editable > requirements.txt`, which captures
exact versions including transitive dependencies, but it captures
what was installed *on Windows* and a few packages have
platform-specific variants. This is genuinely weaker than
package-lock.json. Name it in the report's limitations rather than
claiming equivalence.

**Decision made:** app/ rather than src/ as the package directory,
correcting the earlier plan. `from src.config import ...` reads
oddly; app/ is the standard FastAPI layout and gives clean imports.

**Decision made:** hatchling rather than setuptools as build backend.
Three lines versus more configuration and decades of legacy
behaviour. Neither ships in the final image — build-time only.

**File order correction:** The plan had the detector Dockerfile
before main.py, repeating exactly the mistake corrected at File 012
— a Dockerfile cannot package an application that does not exist.
Corrected: 014 pyproject.toml, 015 app/main.py, 016 .dockerignore,
017 Dockerfile, 018 compose revisit. Phase 0 is 18 files, not 16.

**Commit:** `feat(detector): add python project manifest and dependency lock`

## 2026-09-10 — Day 4 — File 015: apps/detector/app/main.py

**What we built:** The FastAPI application for the detection service
— app instance with OpenAPI metadata, a monotonic start timestamp,
and a synchronous /health endpoint returning status and uptime.
Fifteen lines, and it also generates interactive documentation at
/docs for free.

**Why we built it:** This is the detector's entry point. It exposes
only /health today because File 018's compose revisit needs a
healthcheck to know whether the service is up — a service that
cannot answer "are you alive?" cannot be orchestrated. Detection
endpoints come later. The service exists at all because tree-sitter,
APTED, PyTorch and transformers are Python-only, and because tree
edit distance is CPU-bound work that would block Node's
single-threaded event loop for seconds at a time.

**Why a separate file:** Separate from the API by language and by
workload. Within the detector, it lives in app/ rather than at the
project root because a root main.py is not part of a package, so
`from config import settings` would only resolve when launched from
that exact directory. Inside app/ with __init__.py present it
becomes `from app.config import settings`, resolvable from pytest
and from the container. main.py will stay thin — routers, middleware
and assembly only — with endpoints moving to app/api/routes.py at
File 050.

**Plan correction:** I had said this file would include settings via
pydantic-settings. app/config.py is already scheduled at File 047 in
Phase 4, and the skeleton needs no configuration yet — uvicorn takes
its port from the command line. Writing it now would mean writing it
twice.

**Libraries introduced:** No new packages. `fastapi` used for the
first time: FastAPI() to create the app, @app.get(path) to register
a route, and returning a dict to produce a JSON response. `time`
from the standard library for monotonic().

**Functions written:**
* `health()` — returns {"status": "ok", "uptime": N} with HTTP 200.
  Computes monotonic() - _started_at, rounds to 3dp, returns a dict
  that FastAPI serialises. No inputs, no I/O, no realistic failure
  mode. Synchronous, so FastAPI runs it in a thread pool.
* Module body runs once at import: creates `app`, captures
  _started_at.

**Concepts learned:** decorator · module-level code · __init__.py ·
namespace package · monotonic clock vs wall-clock time · thread
pool · event loop · OpenAPI · Swagger UI · PEP 8 import grouping ·
leading underscore convention

**Decorators explained:** @app.get("/health") above a function is
shorthand for `health = app.get("/health")(health)`. app.get()
returns a decorator, which registers the function in FastAPI's
routing table and returns it unchanged. The Express equivalent
passes the handler as an argument instead; Python's version reads
more declaratively because the route sits directly above the
function it belongs to.

**Decision made:** `def` rather than `async def`. FastAPI accepts
both — async def runs on the event loop, plain def is offloaded to a
thread pool. /health works either way, but the detection endpoints
will be genuinely CPU-bound (APTED on a 500-node tree) and *must* be
synchronous so they do not block the loop. Establishing the pattern
now means one fewer thing to get wrong at File 050. This is also the
answer to "doesn't Python have the same event-loop blocking problem
as Node?" — it does, and the thread-pool offload is the mechanism
that addresses it.

**Decision made:** time.monotonic() rather than time.time().
Wall-clock time can jump backwards when NTP corrects the system
clock, so subtracting two readings across such a jump gives a
negative uptime. monotonic() only ever increases; its absolute value
is meaningless but differences are guaranteed correct. Node's
process.uptime() handles this internally.

**Decision made:** Module-level `app` rather than a factory
function, the opposite of File 010's decision on the Node side.
FastAPI's TestClient expects a module-level app and pytest fixtures
handle test isolation, so the underlying concern is solved
differently rather than ignored. Following each ecosystem's
convention beats forcing symmetry between two frameworks.

**Decision made:** Uvicorn directly rather than behind Gunicorn.
Production Python often runs Gunicorn managing uvicorn workers for
supervision and multi-core use, but Docker already supervises and
Compose can scale replicas. Same reasoning as rejecting PM2 at
File 011 — one supervisor per process.

**Decision made:** No CORS and no security headers, unlike app.ts.
Both are browser mechanisms, and this service only ever talks to the
Node API over the internal Docker network. Adding them would be
cargo-culting from the Express side.

**Known temporary state:** No return type annotation, so the
OpenAPI schema describes the response as an untyped object. A
Pydantic response model would fix it, and belongs in app/schemas.py
at File 048 with the rest of the contracts rather than as a stray
definition here.

**Confirmed working:** /health returned status and uptime. /docs
rendered interactive Swagger UI with the project title and a working
"Try it out" button — generated entirely from the fifteen lines,
with no configuration or separate spec file. /openapi.json served
the raw machine-readable spec. Ctrl+C shut down cleanly with
"Application shutdown complete", unlike tsx watch on the Node side —
uvicorn's reloader forwards SIGINT to its worker rather than killing
it.

**Commit:** `feat(detector): add fastapi app with health endpoint`

## 2026-09-10 — Day 4 — File 016: apps/detector/.dockerignore

**What we built:** The build-context exclusion list for the detector
image — three virtual environment names, bytecode and compiled
extension modules, packaging metadata, three tool caches, .env and
variants, git and build metadata, markdown, tests, coverage output,
Jupyter checkpoints, editor directories and OS junk.

**Why we built it:** Same job as File 013, but the failure mode here
is worse. The venv holds 29 packages compiled for Windows —
pydantic-core shipped as pydantic_core-2.46.5-cp313-cp313-win_amd64,
a .pyd binary that is Windows-only and amd64-only. Copied into a
Linux container it produces "cannot open shared object file", an
error that says nothing about the real cause. There is a second,
Python-specific reason: local Python is 3.13 while File 017's image
pins 3.11, and site-packages layout is version-specific
(lib/python3.13/), so even Linux-compatible binaries would sit at
paths the container cannot find. Two independent reasons the venv
must stay out. A Node node_modules copied into a Linux image mostly
still works; a Python venv produces import errors that look like
broken code.

**Why a separate file:** Forced by Docker — .dockerignore must sit
at the build context root, and we have two contexts (apps/api and
apps/detector). A root-level file would be ignored by both. Correct
on the merits too: only about a third of the patterns overlap. The
API excludes node_modules and dist; the detector excludes .venv,
__pycache__, .pytest_cache and .ruff_cache. Merging would mean each
context carrying patterns meaningless to it.

**Libraries introduced:** None. Read by the Docker CLI before
anything reaches the daemon, which is why an excluded file is
genuinely unreachable rather than merely blocked — as the File 013
test demonstrated.

**Functions written:** None. A pattern list.

**Concepts learned:** compiled extension module (.pyd on Windows,
.so on Linux) · wheel and platform tags (cp313-cp313-win_amd64) ·
bytecode cache · egg-info · tool cache

**Decision made:** Excluded three venv names — .venv, venv and env.
Only .venv exists here, but the convention genuinely split: modern
tooling defaults to .venv, older tutorials use venv, some use env.
Two extra lines against a teammate following a different tutorial.

**Decision made:** Listed tests/ and .mypy_cache before they exist.
Slightly against the usual rule about not building for
hypotheticals, but the cost is one line each and the alternative is
a directory silently entering the image later when nobody is
thinking about this file. Different from a hypothetical
*abstraction*, which imposes cost every day it exists.

**Decision made:** Denylist rather than `*` plus negations, and no
negations at all. Same reasoning as Files 002 and 013 — the
allowlist form is safer against leaks and means every new file
requires editing this file first, and negations are a known source
of silent failure.

**Not yet testable:** There is no detector Dockerfile, so this
cannot be verified by building. Confirmed instead that the excluded
directories are the ones actually present, and inspected the venv's
.pyd files to see the win_amd64 platform tags first-hand. Real test
comes at File 017.

**Commit:** `chore(detector): add dockerignore for venv, bytecode and tool caches`

## 2026-09-11 — Day 5 — File 017: apps/detector/Dockerfile

**What we built:** A two-stage Docker build for the detector. The
build stage creates a venv at /opt/venv and installs from
requirements.txt; the runtime stage starts clean, sets the two
standard Python container env vars, creates a non-root appuser,
copies the venv wholesale and then the source, and runs uvicorn in
exec form bound to 0.0.0.0.

**Why we built it:** The local environment cannot be shipped. The
.venv holds Windows binaries compiled for Python 3.13; the container
needs Linux binaries for 3.11. There is no path from one to the
other except reinstalling from requirements.txt inside the image.
It also unblocks File 018 — a missing Dockerfile is why the compose
file has only three services.

**Why a separate file:** One Dockerfile per app, forced by the build
context rule and correct anyway — the API needs Node 22, the
detector needs Python 3.11 with tree-sitter and eventually PyTorch.
Separate from pyproject.toml by role: that declares what the project
depends on, this describes how to package it.

**Libraries introduced:** No packages. Base image
python:3.11-slim-bookworm, the same Debian 12 base as the Node
images, so both containers share one OS.

**Functions written:** None. Declarative build instructions.

**Concepts learned:** manylinux wheel · loopback interface ·
binding to 0.0.0.0 · output buffering · PATH · UID

**The line that would have cost hours:** --host 0.0.0.0 in the CMD.
Uvicorn defaults to 127.0.0.1, and inside a container that is the
container's *own* loopback — a server bound there accepts
connections from inside the container and nowhere else. Docker's
port mapping arrives on the external interface, finds nothing
listening, and refuses the connection. The container starts fine and
the logs say nothing about a binding problem. This is the mirror of
the File 005 lesson: there we learned not to *connect* to localhost
inside a container; here, not to *listen* on it. Same fact, both
ends.

**Why a venv inside a container at all:** it looks redundant since
the container is already isolated. Without one, pip scatters
packages into /usr/local/lib/python3.11/site-packages and binaries
into /usr/local/bin, so copying them between stages means picking
through system directories and risking overwriting base-image files.
A venv puts everything under one path, so
COPY --from=build /opt/venv /opt/venv moves the whole dependency
tree in one instruction. ENV PATH="$VIRTUAL_ENV/bin:$PATH" is the
equivalent of `activate` — activation is only a PATH change, and
`source activate` cannot be used in a Dockerfile because each RUN is
a separate shell.

**Two Python-specific env vars, both standard:**
* PYTHONDONTWRITEBYTECODE=1 — the container filesystem is discarded
  on exit, so caching .pyc files buys nothing, and a read-only
  filesystem would make the writes fail.
* PYTHONUNBUFFERED=1 — Python buffers stdout when it is not a
  terminal, which inside a container means log lines sit in a buffer
  until it fills or the process exits. The symptom is `docker logs`
  showing nothing and then dumping everything at shutdown, with the
  last lines before a crash lost entirely.

**Decision made:** Multi-stage even though Python has no compile
step. Today it saves maybe 10MB, which is arguably building for a
hypothetical. The difference is that the future need is certain, not
speculative: File 051 builds tree-sitter grammars and needs a C
compiler. With multi-stage that becomes one apt-get in the *build*
stage while runtime stays clean; single-stage it means either
shipping a compiler in production or restructuring under time
pressure. A hypothetical *abstraction* costs you every day it
exists; a hypothetical *structure* costs you once.

**Decision made:** python:3.11-slim over alpine. Stronger reason
than on the Node side — many Python packages ship manylinux wheels
targeting glibc, so on musl pip finds no compatible wheel and
compiles from source. For pydantic-core that means installing a Rust
toolchain; for PyTorch at Tier 3 it is effectively impossible.

**Decision made:** 3.11 rather than 3.13, diverging from the local
interpreter. PyTorch and tree-sitter lag Python releases, so a
package with no 3.13 wheel will have a 3.11 one. Pinning the
container to the older version means the thing that must work in
production is the thing we tested. ruff's target-version = "py311"
guards the gap by flagging syntax the container cannot run.

**Decision made:** Install from requirements.txt rather than
pip install -e . The lockfile pins exact versions while
pyproject.toml has floors that could resolve differently on
different days, and an editable install makes no sense in a built
image.

**Decision made:** Created a user rather than using an existing one.
Unlike the official Node images, which ship a `node` user, the
official Python images ship no non-root user at all.

**Decision made:** No --reload and no --workers in the CMD. Reload
is a development file watcher; workers would put a process manager
inside the container, and Compose can scale replicas. One supervisor
per process, same as rejecting PM2 at File 011.

**Limitation tested for the first time:** requirements.txt was
generated by pip freeze on Windows under Python 3.13, and this is
the first time it has been installed on Linux under 3.11. pip freeze
outputs name==version, which is platform-neutral, so it should
work — but this is exactly the weakness named at File 014.

**Commit:** `feat(detector): add multi-stage dockerfile with venv and non-root runtime`

## 2026-09-11 — Day 5 — File 018: infra/docker-compose.yml (revisit)

**What we built:** The api and detector services, completing the
five-service stack. api builds from ../apps/api, loads infra/.env in
bulk, waits for all three data services to report healthy, and gets
a 15-second stop grace period. detector builds from ../apps/detector
with no dependencies and no configuration. Both have healthchecks
written in their own runtime.

**Why this revisit exists:** File 006 stopped at three services
because Compose errors on a missing Dockerfile and neither
application had one. Both now do. But the real addition is startup
ordering — containers report "running" within a second while
MongoDB takes 10–20 seconds to accept connections, so without it the
API starts, fails to connect and crashes. The healthchecks written
at File 006 finally do something. This is also what makes the
README's "docker compose up" claim true for the first time.

**Why not a separate file:** Compose describes how services relate,
and these two relate to the existing three. A second compose file
would mean two networks, no cross-file depends_on, and no way to
bring the system up with one command.

**Libraries introduced:** None. Two images are now built rather than
pulled — codeguard-api and codeguard-detector, from Files 012 and
017.

**Functions written:** None. The two healthcheck commands are
one-line programs, but they run inside the containers.

**Concepts learned:** startup ordering · service_healthy condition ·
build context path resolution · environment precedence · grace
period · graceful degradation · least privilege · circuit breaker

**Problem faced:** A healthcheck runs *inside* the container, so it
can only use tools that image contains. The MinIO healthcheck uses
curl because the MinIO image has it, but neither
node:22-bookworm-slim nor python:3.11-slim does — slim variants
strip it. A curl-based check would fail with "executable not found"
and leave the container permanently unhealthy with a misleading
error.

**How we solved it:** Used each language runtime, already present.
Node 22 has fetch as a global (stable since Node 18), so
`node -e "fetch(...).then(r => process.exit(r.ok ? 0 : 1))"` with a
.catch for connection refused. Python uses urllib.request from the
standard library — urlopen raises on a non-2xx status, and an
uncaught exception exits non-zero, so no explicit exit code is
needed. Rejected installing curl: apt-get in both Dockerfiles, ~10MB
each, and a larger attack surface for something both runtimes
already do.

**Gotcha:** build context paths resolve relative to the *compose
file's* directory, not the working directory. Since the compose file
is in infra/, reaching apps/api means ../apps/api. Writing
./apps/api gives "path infra/apps/api not found" — the same class of
error as the git add and docker build working-directory mistakes.

**Two things about localhost, now fully resolved:** inside a
container, localhost means that container. So it is *correct* in a
healthcheck, which reaches the container's own service, and *wrong*
when reaching another service, which needs the compose service name.
Same word, opposite meaning depending on the target. There is a
matching asymmetry in the frameworks: Express's app.listen(port)
binds all interfaces by default, while uvicorn defaults to
127.0.0.1, which is why File 017's CMD needed --host 0.0.0.0. The
healthchecks work either way because they originate inside the
container.

**Decision made:** condition: service_healthy rather than plain
depends_on. The plain form waits about a second for the container to
exist. Also rejected a wait-for-it script — the classic
pre-healthcheck solution — because it means a shell script in the
image, a wrapper around CMD that reintroduces the PID 1 problem, and
a TCP port check that says nothing about whether MongoDB finished
initialising.

**Decision made:** Application-level connection retry is still
planned for db/connect.ts, but as a complement rather than a
substitute. Retry is more robust in production because a database
can restart mid-life, not just at boot; healthchecks stop every
startup burning through retries unnecessarily. Both, not either.

**Decision made:** The API does *not* depend on the detector. It
should start and serve logins, dashboards and uploads even if the
detector is down, with detection jobs queuing in Redis until it
recovers. Making the API wait would mean a detector failure takes
down the whole platform. Same graceful-degradation principle as the
baseline-confidence design, applied to infrastructure. File 045's
detectorClient gets a timeout and circuit breaker for the same
reason.

**Decision made:** stop_grace_period 15s on the api, deliberately
longer than the 10-second force-exit timer in server.ts. Both at 10
would race — Docker might SIGKILL at the same instant our code
force-exits, losing the exit code and the final log line. Fifteen
guarantees our timer fires first, so the process always controls its
own exit. The two numbers are now a deliberate pair.

**Decision made:** env_file for the api rather than eighteen
explicit environment lines. Honest trade-off: the container now
receives MONGO_ROOT_USER and MONGO_ROOT_PASSWORD, which it never
uses since its credentials are embedded in MONGO_URI. That is a
small violation of least privilege. The alternative is eighteen
lines that must stay in sync with env.ts, and both values are
already in the same file. Maintenance cost wins — name it in the
report rather than pretending it is clean.

**Environment precedence, worth remembering:** environment: beats
env_file:, which beats Dockerfile ENV. So the Dockerfile's
NODE_ENV=production is overridden by .env's development — which is
why docker run --env-file printed "development mode" at File 012.
Correct for now, since stack traces are useful while building. For
the demo, add environment: NODE_ENV: production.

**Decision made:** No source volume mounts. The image runs compiled
dist/, not src/, so a mount would achieve nothing without also
running tsc --watch inside the container — putting a compiler in the
production image. Consequence stated plainly: changing API source
requires docker compose up --build. The fast development loop stays
npm run dev locally; the compose stack is the integration and demo
environment. If rebuilds become painful, Compose's develop: watch is
the tool, but that is a Tier 2 concern.

**Verified:** All five containers reached healthy. curl against
:4000/health and :8000/health both returned JSON.
`docker exec codeguard-api node -e "fetch('http://detector:8000/health')"`
returned the detector's response — the Node container calling the
Python container by service name over the private network, with no
port mapping involved. That is the exact path detectorClient will
use at File 045.

**Phase 0 complete.** 18 files. Repository scaffolding, formatting
rules, secrets handling, a five-service Docker stack, a Node API
with validated config and graceful shutdown, and a FastAPI detector
— all reproducible with one command.

**Commit:** `feat(infra): add api and detector services with health-gated startup`

## 2026-09-11 — Day 5 — File 019: apps/api/src/db/connect.ts

**What we built:** The MongoDB connection layer — three lifecycle
event listeners registered before connecting, a retry loop with
exponential backoff (1s, 2s, 4s, 8s across five attempts), tuned
connection options, and a disconnect function wired into the
graceful-shutdown path from File 011.

**Why we built it:** Mongoose needs an open connection before any
model can be used, and that connection has a lifecycle — it can fail
at startup, drop mid-life, recover, and must close cleanly. Without
event listeners a dropped connection is silent: queries start
hanging and nothing in the logs explains why.

**Why a separate file:** Connection is infrastructure; schemas are
domain. No model file should care how the connection was established
or whether it retried. Also a leaf module, like config/env.ts — it
imports mongoose and env and nothing else of ours, so tests can
import it to connect to an in-memory MongoDB without pulling in the
HTTP server. In db/ rather than services/ because it will gain
company: seed helpers, possibly migrations.

**Libraries introduced:**
* `mongoose` — an ODM (Object-Document Mapper) adding schemas,
  validation, type casting, middleware hooks and population on top
  of the raw MongoDB driver. MongoDB itself is schemaless, so
  application-layer enforcement is exactly what we want for a
  provenance enum that must be one of three values. Chosen over the
  native mongodb driver, which is faster with no abstraction to
  learn but would mean hand-writing validation for every collection
  and losing TypeScript types on query results. Chosen over Prisma,
  whose generated types are excellent but whose MongoDB support is
  less mature than its SQL support, and which adds a separate schema
  language plus a codegen step. Ships its own types, so no @types
  package.

**Functions written:**
* `connectDb()` — registers listeners, then connects with up to five
  attempts and exponential backoff. Takes nothing, returns
  Promise<void>, throws the last error after five failures.
* `disconnectDb()` — closes the connection pool, awaited so it
  cannot race with process.exit.

**Concepts learned:** ODM vs ORM · connection pool · exponential
backoff · server selection · Mongoose buffering · singleton ·
replica set

**Why retry when compose already gates on healthchecks:** they cover
different situations. The healthcheck runs once, at boot, and only
inside Compose. The retry loop covers local npm run dev, where
nothing gates startup, and MongoDB restarting at 3pm on a Tuesday.
Complementary, not duplicate.

**Decision made:** Listeners registered before connect(), not after.
An event fired before its listener exists is lost, so connecting
first would miss any error during the initial handshake.

**Decision made:** console.warn for disconnection rather than
console.error. A dropped connection is not necessarily fatal —
Mongoose reconnects automatically. Reserving error for things
needing attention keeps the signal useful.

**Decision made:** serverSelectionTimeoutMS 5000 rather than the
default 30000. Thirty seconds is right when a replica set might be
electing a new primary; we run a single standalone node, so either
it is there or it is not. Five seconds means a failed attempt fails
quickly enough for the retry loop to actually run.

**Decision made:** maxPoolSize 20 rather than the default 100. Our
concurrency is a handful of teachers and a few dozen students; 100
idle connections is memory neither side needs.

**Decision made:** Accepted Mongoose 7+'s strictQuery default of
false, and this is a *security* choice. With strictQuery true, a
filter field not in the schema is silently removed from the query —
so a typo like `find({ studentld: id })` with a lowercase L would
drop the filter and return *every* submission. In an
academic-integrity system a silently-widened query is a data leak.
False means the condition passes through and matches nothing, which
fails visibly.

**Decision made:** Kept bufferCommands at its default of true, so
queries issued while disconnected queue rather than failing. Makes a
two-second reconnection invisible to users. The cost is that a
longer outage makes requests hang until serverSelectionTimeoutMS
expires — acceptable at five seconds.

**Decision made:** Fail fast at startup, buffer during runtime. Two
different situations: a missing database at boot means broken
configuration, so exit 1; a database dropping mid-life is usually
transient, so buffer and let Mongoose reconnect.

**Decision made:** Explicit connectDb/disconnectDb rather than
connecting on import. env.ts deliberately runs on import, but
connecting is slow and can fail — a test that merely imports a model
should not open a database connection.

**File 011 revisit:** server.ts now awaits connectDb() before
creating the app, exits 1 if it throws, and calls disconnectDb()
inside the server.close callback. Ordering matters — HTTP drains
first, then the database, because closing MongoDB while requests are
still in flight would make those requests fail. Top-level await
works here, which is a direct payoff for choosing ESM at File 007.

**LIMITATION recorded — no transactions.** MongoDB transactions
require a replica set, and our compose file runs a standalone node.
This matters: when faculty confirm a submission as clean we would
ideally update the Submission, append to the AuditLog and update the
baseline atomically. Without transactions those are three
independent writes, and a crash between them leaves inconsistent
state. Options were (1) accept it and design for recoverable partial
failure — make the AuditLog write last, so an interrupted operation
leaves no false record; (2) convert to a single-node replica set
with --replSet rs0 plus a bootstrap step; (3) defer. Taking option 1
now with option 2 as documented future work, because option 2 adds
setup complexity for a problem not yet encountered. Name this in the
report's limitations section.

**Commit:** `feat(api): add mongoose connection with retry and clean shutdown`

## 2026-09-11 — Day 5 — File 020: apps/api/src/models/User.ts

**What we built:** The first Mongoose schema — email (unique,
lowercased, trimmed), passwordHash (required, select: false), name,
role (enum of three, indexed), rollNo (unique + sparse, uppercased),
isActive soft-delete flag, and automatic timestamps. Plus a toJSON
transform stripping passwordHash and __v, and three exports: the
inferred type, the hydrated document type, and the model.

**Why we built it:** Every other collection points at this one —
Course has faculty and enrolled students, Submission has a student,
AuditLog records which faculty member decided. It also carries the
role field that gates the entire authorisation model.

**Why a separate file:** One file per model is the Mongoose
convention and is forced by a real constraint —
mongoose.model("User", schema) can only be called once per process,
or you get OverwriteModelError. Separate from db/connect.ts because
connection is infrastructure and schemas are domain. Separate from
auth logic because this defines *what a user is*; hashing, signing
and permission checks are behaviours operating on users. Putting
hashPassword here would mean importing bcrypt into every file that
merely wants to read a name.

**Libraries introduced:** None new. mongoose used for the first time
as a schema tool: new Schema() for shape and validators,
schema.set("toJSON") for serialisation control, model() to register,
InferSchemaType and HydratedDocument for typing.

**Functions written:** Only the toJSON transform — mutates the plain
object Mongoose builds, deleting passwordHash and __v, then returns
it. Fires on JSON.stringify(), which res.json() calls internally.
Does *not* fire on console.log(), so a deliberately-selected hash
could still reach the logs; pino redaction at File 027 covers that.

**Concepts learned:** schema · model · document · collection ·
validator vs setter · index · unique index · sparse index ·
collection scan · soft delete · select: false · projection · E11000 ·
version key __v · InferSchemaType · HydratedDocument

**Key gotcha — unique is not a validator.** It reads like one but is
an instruction to create a unique *index* in MongoDB. Three
consequences: enforcement is the database's, so a duplicate throws
E11000 rather than a Mongoose ValidationError, and File 026 must
handle both shapes; it does not work until the index is built, so
with autoIndex disabled in production duplicates pass silently; and
it says nothing about existing data, so adding it to a collection
with duplicates makes index creation fail at startup. Confirmed in
testing: the duplicate email produced E11000 while the invalid role
produced a ValidationError — genuinely different error types.

**Problem faced:** Students have roll numbers; faculty and admin do
not. unique: true alone would treat every faculty member as having
rollNo: undefined, and a unique index rejects duplicate absences —
so the second faculty account would fail with E11000.

**How we solved it:** sparse: true, which excludes documents that
*lack* the field from the index entirely. One sharp edge: sparse
skips missing fields, not null ones, so explicitly setting
rollNo: null would put the document in the index and a second null
would collide. The seed script must omit the field for faculty
rather than setting it null.

**Decision made:** select: false on passwordHash rather than relying
on discipline. The dangerous case is the forgotten one —
res.json(await UserModel.find()) in a list endpoint would serialise
every hash. Secure by default, with exactly one place
(authController.login) opting in via .select("+passwordHash").

**Decision made:** A toJSON transform *as well as* select: false.
Deliberately redundant — two independent mechanisms must both fail
for a hash to reach a client. Same defence-in-depth principle as
USER node in the Dockerfile.

**Decision made:** No pre("save") hashing hook, against the common
Mongoose pattern. A hook guarantees hashing, but it makes
user.save() sometimes slow in a way the call site cannot see (bcrypt
is intentionally expensive), makes the model depend on bcrypt so
every file importing User pulls in a native module, and makes tests
slow since seeding 30 users means 30 unrequested bcrypt rounds.
Hashing in authController keeps the cost visible where it is paid.
Honest trade-off: the hook is safer against forgetting, and we are
accepting a small risk for an explicit cost, with only two write
paths.

**Decision made:** InferSchemaType rather than a hand-written
interface passed as new Schema<IUser>(). One source of truth — the
alternative duplicates every field, and forgetting one makes the
type lie. Same reasoning as z.infer for Zod at File 007.

**Decision made:** Soft delete via isActive rather than removing
records. Submissions and audit-log entries reference a user's _id,
so deletion orphans them. An AuditLog saying "faculty X flagged
submission Y" is worthless if X no longer exists — in an evidence
system, records must outlive the people in them.

**Decision made:** role as a single string rather than an array of
permissions. Full RBAC is more flexible and considerably more
machinery; three roles with clear boundaries cover the spec. If
per-course permissions become necessary they belong on Course, not
on User.

**Decision made:** Indexed role but not name. Every index costs
storage and slows writes, since each insert must update it. Index
fields you filter or sort by — we will run find({ role: "student" })
constantly and never sort by name.

**Confirmed working:** "  Sam@Invertis.AC.IN  " saved as
"sam@invertis.ac.in" and "bcs2023126" as "BCS2023126" — setters
normalising. The created document serialised without passwordHash or
__v. A plain findOne returned undefined for the hash;
.select("+passwordHash") returned it. Two faculty without rollNo
both saved. db.users.getIndexes() showed _id_, email_1, role_1 and
rollNo_1 with sparse: true.

**Commit:** `feat(api): add user model with roles and protected password field`

## 2026-09-13 — Day 6 — File 021: apps/api/src/models/Course.ts

**What we built:** The Course schema — code (uppercased, trimmed),
title, academicYear validated by regex, a faculty reference to User,
an array of enrolledStudents references with a multikey index, an
isArchived soft-delete flag, timestamps, and a compound unique index
on { code, academicYear }.

**Why we built it:** A course is the unit of scope for almost
everything. The faculty field decides who may configure detection
weights and make decisions — requireRole says what kind of user you
are, this says which courses are yours. The enrolledStudents list is
what makes cohort-relative analysis possible, and two of our core
ideas depend on it: difficulty-normalised similarity (z-scores
against the cohort distribution, so "sort an array" does not flood
the queue) and cohort-controlled change-point detection (if the
whole class shifted, the instructor taught something new; if only
one student shifted, that is signal). Neither works without knowing
who the cohort is, so this file is a prerequisite for the project's
stated research contribution.

**Why a separate file:** One file per model, forced by
OverwriteModelError. Separate from User because the lifecycles
differ — a user exists for years across many courses, a course for
one semester with many users. Separate from Assignment even though
assignments always belong to a course, because a Submission must
reference one assignment directly and embedded assignments would
have no stable identifier to point at.

**Libraries introduced:** None new. Mongoose used for references
(Schema.Types.ObjectId with ref), populate(), compound indexes and
multikey indexes for the first time.

**Functions written:** Only the toJSON transform, stripping __v.

**Concepts learned:** ObjectId · reference · populate() · embedding ·
referential integrity · compound index · prefix rule · multikey
index · unbounded array anti-pattern · document size limit · rule of
three · regex validator

**Decision made:** A compound unique index on { code, academicYear }
rather than unique: true on code. The same course code runs every
year, so uniqueness is a property of the pair — which field-level
unique cannot express, since it only ever constrains one field.
Confirmed in testing: CS-501 in 2027-28 saved fine, CS-501 in
2026-27 twice threw E11000.

**Learned — the prefix rule:** a compound index on { code,
academicYear } serves queries filtering on code alone, or on both,
but not on academicYear alone. If "all courses in 2026-27" becomes a
common dashboard query it would do a collection scan and need its
own index. Fine at a few dozen courses; noted as a known property
rather than a surprise.

**Decision made:** Reference students rather than embed them. Three
reasons. Students belong to many courses, so embedding duplicates
data and a student changing their email means updating every course
— missing one leaves inconsistency. Submissions need a stable _id to
point at, which embedded copies do not have. And the two entities
change independently. General rule: embed data owned by and read
with its parent that has no independent identity; reference data
that exists on its own. We *will* embed DetectionResult's evidence
payload for exactly that reason — matched subtree pairs belong to
nothing else and are always read with the result.

**Decision made:** An array of references rather than a separate
Enrolment collection. At 30–60 students the array is comfortably
bounded — even 500 ObjectIds is 6KB against MongoDB's 16MB document
limit — and a third collection would mean a join on every query for
metadata the spec does not require. Trigger to revisit: if enrolment
date or dropped status is needed. Plausible, because a student who
enrolled late has fewer anchor samples and therefore lower baseline
confidence. Likely Tier 2.

**Important limitation, worth conceding in the viva:** MongoDB has
no foreign keys. `ref: "User"` is Mongoose metadata for populate(),
not a database constraint — we can store an ObjectId pointing at a
user that does not exist, and nothing objects. Postgres would
enforce this. We enforce it at the application layer instead, and a
deleted user would leave dangling references. This is exactly why
User has an isActive soft-delete flag rather than being removed. The
two decisions connect directly.

**Decision made:** default: [] on enrolledStudents. Without it the
field is undefined on a new course and
course.enrolledStudents.length throws. An empty array means every
consumer can iterate without a null check.

**Decision made:** Multikey index on enrolledStudents. It makes
find({ enrolledStudents: studentId }) fast — note the syntax matches
against the array as if it were a scalar, and MongoDB checks whether
any element matches. That is the student dashboard's primary query.
Cost is 30 index entries updated per insert instead of 1, acceptable
because enrolment changes rarely and is read constantly.

**Decision made:** academicYear as a regex-validated string rather
than a number or a date. A number cannot express "2026-27" spanning
two calendar years; a date implies a precision nobody has. Without
the regex, three people would enter three formats and the "courses
this year" query would silently miss some.

**Deliberately not done yet:** the toJSON transform is now nearly
identical in two models and will be written seven times by File 026.
Not extracting a shared plugin yet — with two instances we would be
guessing what varies. File 027 (models/index.ts) has all seven in
view. Rule of three.

**Commit:** `feat(api): add course model with faculty and enrolment references`

## 2026-09-13 — Day 6 — File 022: apps/api/src/models/Assignment.ts

**What we built:** The Assignment schema — a course reference,
title, description, a language enum limited to python and java, a
provenance enum defaulting to takehome, dueAt as a Date, acceptsLate
and maxSubmissions with range validation, an isPublished draft flag,
plus two compound indexes: { course, title } unique, and
{ course, dueAt: -1 } for the dashboard query. Also exports
LANGUAGES and PROVENANCE as `as const` arrays.

**Why we built it:** An assignment is the unit submissions are
compared *within* — comparing a sorting exercise against a graph
traversal is meaningless, so every Layer 1 similarity computation is
scoped to one assignment. Two fields shape the whole pipeline:
language decides which tree-sitter grammar the detector loads, and
provenance is what the entire baseline-integrity subsystem depends
on.

**Why a separate file:** One model per file per OverwriteModelError.
Separate from Course because a Submission must reference one
assignment directly and embedded assignments have no stable _id to
point at. Separate from DetectionConfig even though both hold
configuration — an assignment describes what students must do
(deadline, language, instructions) while DetectionConfig describes
how faculty want detection tuned (w1/w2/w3, thresholds). Different
owners, different change frequency.

**Libraries introduced:** None new. First use of `as const` exported
arrays, index direction (-1), range validators and Date casting.

**Functions written:** Only the toJSON transform — third identical
instance now.

**Concepts learned:** as const · literal union type ·
denormalisation · covering a sort · index direction · BSON · range
validator · draft state

**The `as const` pattern, and why it matters:** without it,
LANGUAGES is string[]; with it, it is readonly ["python","java"] —
a tuple of exact literals. One declaration then serves three
purposes: Mongoose validation via enum: LANGUAGES, a TypeScript
union via typeof LANGUAGES[number] so `lang === "c++"` is a compile
error, and runtime reuse so File 031's Zod schema can do
z.enum(LANGUAGES). One source of truth for the API boundary, the
database and the type system.

**Inconsistency noticed and recorded:** User.ts should have exported
its role values the same way. They will be needed by requireRole at
File 030 and by Zod at File 031, and will otherwise be duplicated.
TODO: add `export const ROLES = [...] as const` to User.ts when next
touching it.

**Decision made — where provenance lives.** It sits on Assignment
rather than on each Submission, because provenance is a property of
the *conditions* and conditions are set per assignment: if a lab ran
under supervision, every submission to it was supervised. Storing it
per submission would mean 30 copies of the same value and the
possibility of two submissions to one invigilated lab disagreeing
about whether it was invigilated. **But File 023's Submission will
also carry provenance, denormalised at creation time**, for two
specific reasons: (1) immutability — if faculty later correct an
assignment's provenance, submissions already scored under the old
value must keep it, because a result computed under invigilated
assumptions does not retroactively become a takehome result; and
(2) query performance — "all invigilated submissions by this student
across all courses" is the baseline-anchor query, which with
provenance only on Assignment would be a join across every course
they have taken. Deliberate denormalisation with a stated reason,
which is what separates a design decision from an accident.

**Decision made:** default provenance is "takehome", not
"invigilated". A forgotten field should fail toward caution.
Defaulting to invigilated would silently make unsupervised work
baseline-eligible — exactly the poisoning the subsystem exists to
prevent.

**Decision made:** Two languages, not three. The spec says C++ only
if time allows, and an enum listing a language the detector cannot
parse would let faculty create assignments that fail at detection
time. Scope enforced by schema rather than by intention.

**Decision made:** acceptsLate defaults to true — a late submission
is still analysed, just marked. Refusing it means the student
contributes no baseline sample and no cohort data point. Our job is
evidence-gathering; deadline enforcement is the LMS's.

**Decision made:** maxSubmissions bounded 1–20, default 3. Unlimited
resubmission means unbounded storage and detection work, and a
student iterating 15 times against feedback produces stylometric
noise rather than signal, which degrades their Layer 2 baseline.

**New kind of index:** { course: 1, dueAt: -1 } is the first index
created for *query performance* rather than for a constraint. A
compound index can serve both the filter and the sort, so MongoDB
returns results already ordered instead of sorting in memory.
Direction matters for sorts — an index can be read forwards or
backwards, so this also serves sort({ dueAt: 1 }), but it would not
serve a mixed-direction sort.

**Timezone note, deferred deliberately:** MongoDB stores dates in
UTC and we are in IST (+5:30). A deadline of "midnight on the 20th"
entered by faculty must be converted before storage or it lands 5.5
hours off. That conversion belongs at the API boundary in File 039's
Zod schema, not in the schema — the database's job is to store an
unambiguous instant. Recorded now because timezone bugs are hard to
spot: everything looks fine until someone submits at 11pm.

**Decision made:** No validator forcing dueAt into the future.
Faculty legitimately backdate when importing a past semester's data
for testing.

**Still deferred:** the toJSON transform is now written three times.
Rule of three is technically met, but DetectionResult and AuditLog
may need different treatment, so extracting from five real cases at
File 027 beats guessing from three.

**Commit:** `feat(api): add assignment model with language and provenance`

## 2026-09-13 — Day 6 — File 023: apps/api/src/models/Submission.ts

**What we built:** The Submission schema — references to assignment
and student, attempt number, provenance and language denormalised
from the assignment, originalFilename, objectKey pointing into
MinIO, sizeBytes, a SHA-256 contentHash validated by regex,
lineCount, submittedAt, isLate, a five-state status machine,
failureReason, and a baselineEligible flag. Three compound indexes
and a transform hiding objectKey.

**Why we built it:** Everything the system does happens to a
submission — uploaded, stored, queued, parsed, fingerprinted,
compared, scored, reviewed. Four fields carry the core design:
provenance decides baseline eligibility, contentHash enables an
exact-duplicate short-circuit before any parsing, objectKey points
at the bytes in MinIO, and status distinguishes a running job from a
dead one.

**Why a separate file:** Separate from DetectionResult because a
submission is *what the student gave us* — immutable evidence —
while a detection result is *what the system concluded*, and will be
recomputed when weights are retuned or the parser improves. Merged,
re-running detection would overwrite the record of what was
submitted. Separate from the file bytes because MongoDB caps
documents at 16MB, but the better reason is that presigned URLs let
a browser download directly from object storage without proxying
through the API.

**Libraries introduced:** None new. First cross-model enum reuse —
importing LANGUAGES and PROVENANCE from Assignment.ts, so a
submission can never claim a language an assignment could not have
specified. The `as const` pattern from File 022 paying off.

**Functions written:** Only the toJSON transform, and it is the
fourth instance but **the first that differs meaningfully** — it
strips objectKey as well as __v. Useful information for File 027's
extraction: the common part is __v, and the variable part is
per-model.

**Concepts learned:** SHA-256 · avalanche effect · object key ·
state machine · short-circuit · atomicity gap

**The denormalisation, executed:** provenance and language are
copied from the assignment at creation and never updated. Two
reasons, both stated at File 022 and now concrete. Immutability — if
faculty later correct an assignment's provenance, submissions
already scored under the old value keep it, because a result
computed under invigilated assumptions must not silently become a
takehome result. Query cost — the Layer 2 anchor query is "all
invigilated Python submissions by this student across every course",
which with provenance only on Assignment would be four steps
(courses → assignments → filter → submissions) and is now one
indexed find. Language is denormalised for the same reason, since
baselines are per-language: a student's Python style and Java style
are legitimately different.

**contentHash — the cheapest layer.** SHA-256 is 32 bytes,
hex-encoded as exactly 64 characters, hence the regex; lowercase
normalises because hex can be written either case and two
representations of one hash would defeat the point. Identical bytes
give an identical hash, so a single indexed lookup finds byte-exact
copies before any tree-sitter parse, fingerprinting or APTED.
Honest scope: this catches *only* exact copies — change one space
and the hash is completely different, which is the avalanche
property of a cryptographic hash. That is precisely why Layers 1, 2
and 3 exist. The hash is a free short-circuit, not a detection
layer.

**Decision made:** contentHash indexed but NOT unique. Two students
legitimately submitting identical trivial code should not be blocked
from submitting. Detecting duplication is the system's job;
preventing submission is not.

**Decision made:** objectKey stripped from JSON output. Two reasons.
Information disclosure — the key encodes bucket layout, naming
scheme and other students' identifiers, and a client has no use for
it. And enforcing the access path — files are downloaded via
presigned URLs generated after an authorisation check, so if the key
were in every response a client might construct a direct MinIO URL
and bypass that check. MinIO being bound to localhost today is a
deployment accident, not a design guarantee. Same principle as
passwordHash at File 020.

**baselineEligible — mitigation 2 made concrete.** Defaults to
false, and becomes true only when provenance is invigilated (trusted
by construction) or the submission passed all three layers cleanly
*and* a faculty member explicitly confirmed it. A submission is
evaluated against the baseline but never joins it automatically.
That is what blocks slow poisoning across a semester — the failure
mode where dishonest work gradually becomes "their style" so the
eventual honest submission gets flagged. Stored rather than derived
from provenance, because take-home work *can* become eligible at
trust weight 0.3 through confirmation, which a derived value could
not express, and because it must be auditable: we have to be able to
answer "which submissions are in this student's baseline, and why?"

**Decision made:** isLate stored rather than computed on read. If
faculty extend a deadline, submissions that *were* late at the time
should stay marked late. Same immutability argument as provenance —
the record describes what happened, not what the current
configuration implies.

**Three compound indexes, each for a real query:**
* { assignment, student, attempt } unique — prevents a
  double-clicked upload creating two attempt-3 records.
* { student, provenance, language } — the Layer 2 anchor query, run
  on every take-home submission.
* { status, submittedAt } — the worker scan, oldest first so a
  backlog drains fairly instead of starving old jobs.

**Limitation recorded — atomicity gap.** Enforcing maxSubmissions
needs a count before insert, and count-then-insert is not atomic.
Two simultaneous uploads could both read "2 existing" and both
insert attempt 3. The unique index rejects the second, which is the
right outcome, but it surfaces as E11000 rather than a clean "limit
reached" message. File 040 must catch and translate it. This is the
same class of problem as the missing transactions noted at File 019.

**Why `analyzing` is a distinct state:** without it, a worker crash
leaves the submission stuck in queued forever, indistinguishable
from one nobody has picked up. With it, a submission sitting in
analyzing for an hour is visibly a dead job and can be requeued by a
sweep.

**Decision made:** failed is not a dead end — failureReason records
the cause ("syntax error at line 42", "detector timeout"), which the
student sees. Detection failing is not the student's fault and
should not look like an accusation.

**Decision made:** No grade or feedback field. Out of scope — that
is the LMS's job. This system produces evidence, not marks. And no
previousAttempt back-reference, because the { assignment, student }
prefix of the compound index already finds every attempt in one
query.

**Bug found in the File 022 test script:** collection.drop() returns
when MongoDB *accepts* the request, not when the drop completes, so
Model.init() raced it and MongoDB refused with IndexBuildAborted
(code 276). Fixed by using deleteMany({}) instead, which removes
documents while leaving the collection and indexes intact. This is
the second instance of the same class of problem — an operation that
returns before its effect lands. The first was Mongoose building
unique indexes in the background at File 020.

**Commit:** `feat(api): add submission model with provenance and content hash`

## 2026-09-13 — Day 6 — File 024: apps/api/src/models/DetectionConfig.ts

**What we built:** The per-course detection tuning schema — w1, w2,
w3 bounded [0,1] with a pre-validate hook forcing them to sum to 1,
reviewThreshold, minBaselineConfidence, lowVariancePercentile,
minAnchorsForBaseline, a version counter and updatedBy. Plus an
exported DEFAULT_DETECTION_CONFIG constant used when a course has no
override row.

**Why we built it:** The RPS formula needs weights faculty can
change, and the spec is explicit about per-course configurability.
The right weighting genuinely differs by course — a first-year
course where everyone writes the same twenty-line exercise has
naturally high structural similarity, so w1 should be low or the
queue floods; a final-year project course has almost no structural
overlap, so w1 matters more when it does fire. This file is also
where transparency becomes a data structure: a black box says
"0.82", an evidence system says "0.82 = 0.5x0.9 + 0.3x0.7 +
0.2x0.85, with weights set by your department on 3 March".

**Why a separate file:** Separate from Course despite being keyed by
course — different owners (administrative vs operational tuning),
different change frequency (a course is created once; weights are
adjusted after seeing a semester's queue behaviour), and it is
optional, so embedding four nullable fields in every course document
to serve the minority that override them is wasteful and makes "is
this configured?" ambiguous. Separate from Assignment because the
spec says per-course; per-assignment would mean faculty tuning
weights thirty times a semester.

**Libraries introduced:** None new. First use of Mongoose middleware
— schema.pre("validate", fn).

**Functions written:**
* The pre-validate hook — sums w1+w2+w3 from `this` and calls
  this.invalidate("w1", message) if the absolute difference from 1
  exceeds 1e-6. Written as `function`, not an arrow, because arrows
  do not bind `this` and the hook needs `this` to be the document.
* The toJSON transform — fifth instance.

**Concepts learned:** Mongoose middleware/hook · cross-field
validation · floating-point representation error · epsilon
comparison · override table · spread syntax · configuration
versioning

**Decision made — defaults in code, overrides in the database.** The
obvious alternative is a "global default" row with course: null,
which breaks: MongoDB's unique index treats null as a value, so two
null rows collide, and sparse (which saved us at File 020) excludes
*missing* fields, not null ones. Constants are strictly better — one
version-controlled source of truth visible in a diff, no bootstrap
step so the system works on a fresh database with zero rows, course
stays required and unique with no null cases, and faculty can read
the defaults in the UI without a database round-trip. The read
pattern is `findOne({ course }) ?? DEFAULT_DETECTION_CONFIG`. This
is an *override table*, not a settings table — a row existing means
"this course deviates".

**Why the weights must sum to 1:** so the RPS is bounded in [0,1]
and comparable across courses. If one course used weights summing to
2, its scores would be twice as large and cross-course review queue
ordering would be meaningless.

**The floating-point trap — and a correction.** I claimed
0.5 + 0.3 + 0.2 evaluates to 1.0000000000000002 in JavaScript. It
does not: testing showed it is exactly 1, and strict equality
returns true. The canonical inexact example is 0.1 + 0.2, which is
0.30000000000000004. I reached for a three-term version to match our
weights and asserted it behaved the same way without checking.

**The epsilon is still correct, and here is the actual evidence.**
Enumerating every triple of two-decimal weights that sums to 1 gives
4,851 valid combinations, of which **204 fail strict equality** —
about 4%. Examples: 0.06 + 0.57 + 0.37 and 0.06 + 0.84 + 0.10 both
produce 0.9999999999999999. Without the epsilon, a faculty member
setting those weights would be rejected with a message saying they
do not sum to 1, while looking at three numbers that plainly do.
Math.abs(sum - 1) > 1e-6 accepts all 4,851.

**Two lessons.** Floats are binary fractions and 0.1 has no exact
binary representation, the same way 1/3 has no exact decimal one —
but *which* specific sums round exactly is not something to guess.
And a defensive measure can be right for a reason other than the one
first given: verify the mechanism, not just the conclusion.

**Why a hook here when one was rejected at File 020:** the
distinction is cost and purity. The bcrypt hook was ~100ms,
deliberately slow, pulled a native module into every file importing
User, and made save() mysteriously slow at call sites that could not
see why. This hook is two additions and a comparison, has no
dependency, and is instant. A hook is right for cheap, pure,
always-applicable rules; wrong for expensive operations with
external dependencies.

**HONEST NOTE ON THE DEFAULT WEIGHTS (0.4 / 0.3 / 0.3):** these are
defensible placeholders, not empirically derived values. There is no
labelled data yet, so nobody could derive them. The reasoning is
that w1 (structural) is slightly highest because it is the most
*reliable* signal — AST similarity is deterministic and needs no
student history — while w2 and w3 are equal because behavioural is
the most informative signal when it works but depends entirely on
baseline quality, and AI-content is tuned for precision so it fires
rarely but meaningfully. **The report must say this plainly:**
initial weights are reasonable defaults, faculty-configurable, and
deriving empirically optimal weights requires labelled outcome data,
which is explicit future work. Claiming they were optimised would be
indefensible under questioning.

**Three thresholds, each a mitigation made concrete:**
* minBaselineConfidence 0.4 — mitigation 3. Below this, w2 is
  attenuated toward zero and the RPS leans on Layers 1 and 3. This
  is the threshold at which the system says "I do not know this
  student well enough to judge".
* lowVariancePercentile 5 — mitigation 4. A student whose
  intra-submission style variance sits in the bottom 5% of the
  cohort distribution is flagged. Humans are stylistically noisy;
  consistent AI output is not. Bounded 0.5–25 because 0 would never
  fire and 50 would flag half the class.
* minAnchorsForBaseline 3 — matches the spec's "three to five
  anchors per student per language". Fewer and Layer 2 does not run.

**Decision made:** version and updatedBy are both required.
DetectionResult will store a snapshot of the weights it used plus
this version number, because without it a result computed in March
under w1=0.4 is indistinguishable from one computed in April under
w1=0.6. In a disciplinary hearing, "we cannot tell you which weights
produced this score" is a fatal answer. Same immutability principle
as provenance on Submission.

**Decision made:** No enabledLayers array. Tempting, to let faculty
disable Layer 3 if CodeBERT is unavailable — but setting w3: 0
already achieves it, and two mechanisms for one outcome invite
inconsistency.

**Noticed — four different uniqueness shapes so far**, each matching
the real constraint: User.email single-field (an email identifies
one person); Course { code, academicYear } (a code repeats across
years); Submission { assignment, student, attempt } (attempt numbers
repeat across students); DetectionConfig.course single-field (one
config per course).

**Battle — TS2349/TS2722 on the pre-validate hook.** The callback
style `pre("validate", function (next) {...})` failed to type-check
with four errors: "This expression is not callable. Type
'Record<string, any>' has no call signatures." Cause: schema.pre()
has several overloads, one taking (event, options, fn) and one
taking (event, fn). TypeScript picked the wrong one and inferred
`next` as an options object, so calling it is an error.

**How we solved it:** dropped the callback entirely. A zero-argument
hook is treated by Mongoose as promise-returning, so it proceeds
when the function returns and there is no callback to mistype. And
instead of throwing, the hook now calls
`this.invalidate("w1", message)`, which is the proper Mongoose
mechanism for cross-field validation — it marks a path invalid and
lets the normal validation cycle produce the error.

**This also corrected an earlier claim.** I had said the hook would
produce a Mongoose ValidationError, the same shape as an enum
failure. With next(new Error(...)) that would NOT have been true —
the raw Error propagates unwrapped and File 026 would have needed a
special case for it. With invalidate() the claim is accurate: a
cross-field rule and a field-level rule now produce the same error
shape, so one handler covers both.

**Lesson:** when a library's TypeScript types reject an API copied
from a tutorial, check whether the tutorial predates a newer form of
that API. The types were correct; the API was old.

**Correction to File 023's expected output:** I said five indexes;
there are nine. index: true on assignment, student, contentHash and
status each creates its own, plus objectKey_1 from unique, _id_, and
the three compound ones. Worth recording because it is a real cost —
that collection updates nine index entries per insert.

**Commit:** `feat(api): add detection config with weight validation`

## 2026-09-13 — Day 6 — File 025: apps/api/src/models/DetectionResult.ts

**What we built:** The largest schema in the project. Five
subdocument schemas (span, structural match, feature deviation,
token attribution, window score), three layer blocks each with an
independent status/reason/duration, the RPS with a full weight
snapshot including effectiveW2, configVersion and detectorVersion,
a signalDisagreement flag, revision and isCurrent for versioning,
and a mutable review subdocument. Three compound indexes.

**Why we built it:** Everything before this stored inputs; this
stores conclusions *with their evidence*. The spec's central claim
is that CodeGuard AI is an evidence system rather than a verdict
machine, and that claim is true or false depending on what this
schema holds. If it stored { submission, rps: 0.82 } we would have
built a verdict machine with extra steps — a number nobody can
interrogate. Four fields exist because of specific spec
requirements: per-layer status (mitigation 5, graceful degradation),
baselineConfidence plus effectiveW2 (mitigation 3, attenuation),
lowVariance as a separate block (mitigation 4, "report it as a
separate signal, not folded into the deviation score"), and the
weights snapshot plus configVersion (reproducibility in a hearing).

**Why a separate file:** Separate from Submission because a
submission is what the student gave us — immutable — while a result
is what the system concluded, and *will* be recomputed when weights
are retuned or the parser improves. Separate from AuditLog because a
result is what the system computed and a log entry is what a person
did. Different actors, different immutability guarantees.

**Libraries introduced:** None new. First use of subdocument schemas
with _id: false, and of dot-notation nested paths in an index.

**Functions written:** Only the toJSON transform — sixth instance,
back to the simple __v-only form.

**Concepts learned:** subdocument · _id: false · z-score · difficulty
normalisation · calibration / temperature scaling · token
attribution · sliding window · ablation study · versioned record ·
dot notation in indexes

**The embedding decision, executed.** File 021 set the rule: embed
data owned by and read with its parent that has no independent
identity; reference data that exists on its own. Matched spans,
feature deviations and token attributions are exactly the first
case — they belong to one match inside one result, nothing else will
reference them, and nobody queries "find me all spans". _id: false
matters because Mongoose adds a 12-byte ObjectId to every
subdocument by default, which for a span holding four small integers
is more overhead than payload and implies an identity it does not
have.

**Per-layer status — mitigation 5 as a data structure.** Three
states with genuinely different meanings: ok (ran, produced a
score), skipped (could not run, for a stated reason), failed (tried
and broke). Skipped and failed must stay distinct because a student
with two anchors against a minimum of three is *correct system
behaviour*, while a tree-sitter crash is a bug. Collapse them and
monitoring cannot tell "working as designed" from "broken".

**Why score is optional rather than defaulting to 0.** A skipped
layer has no score, and that is not a score of zero. Zero means "ran
and found nothing suspicious" — a positive finding. Undefined means
"we do not know". The spec puts it exactly right: the system must be
able to say "I do not know this student well enough to judge" rather
than guessing. Defaulting to 0 would guess, in the student's favour,
while looking like evidence.

**Why both w2 and effectiveW2 are stored.** Only the pair lets the
evidence view say: "your department configured w2 = 0.3, but this
student has two invigilated anchors giving baseline confidence 0.28,
below the 0.4 threshold, so the behavioural weight was reduced to
0.09." Store only effectiveW2 and the attenuation is invisible;
store only w2 and the arithmetic does not reconcile. anchorCount is
there so the message can be specific rather than vague.

**Why lowVariance is a separate block, not folded in.** Spec
requirement, with a real reason behind it. Low variance is a
different *kind* of claim from deviation: deviation says "this
submission does not match your history", low variance says "your
history is implausibly uniform for a human". Crucially it works when
the baseline is poisoned, because it needs no clean reference — only
enough samples to measure spread. Folding it into behavioral.score
would let a poisoned baseline suppress the one signal designed to
detect poisoning. cohortPercentile rather than an absolute threshold
because raw variance is meaningless across languages and assignment
types.

**Two numbers per structural match.** similarity is the raw
APTED-derived score; cohortZScore is how many standard deviations
above the assignment's mean it sits. A "reverse a linked list"
assignment has high baseline similarity — 0.85 might be the cohort
median — while on an open-ended project 0.85 is extraordinary. The
queue ranks on the z-score and the evidence view shows both. Note
cohortZScore has no min/max: a z-score is unbounded and can be
legitimately negative.

**Decision made — results are versioned, not overwritten.**
Re-running creates revision 2 and sets revision 1's isCurrent to
false. Three reasons: reviewed evidence must remain retrievable,
because "the score you saw no longer exists" is fatal in a hearing;
the Tier 3 ablation study needs to compare detector versions on
identical submissions; and it is consistent with the project's own
philosophy, since PROJECT_NOTES and AuditLog are both append-only.
Honest cost: every query for "the result" must filter
isCurrent: true, and forgetting that is a real bug class. Mitigated
by both query indexes routing through it, so the correct query is
also the fast one.

**Decision made — a review subdocument rather than a separate
collection, and this breaks the immutability claimed above.** A
separate Review collection would mean a join on every queue page
load for a field that is "pending" in the vast majority of
documents. The compromise: review state is the one mutable region,
everything else is not, File 040's controller will only ever update
review.* fields, and every state change also writes an AuditLog
entry — so the review *history* is append-only even though the
current state is not.

**No guilty or plagiarised review status.** Five states: pending,
contested, dismissed, confirmed_clean, escalated. The system
escalates to a human and stops. That boundary is the entire
"evidence not verdict" claim, enforced by an enum rather than by
policy. confirmed_clean is also what makes a take-home submission
baseline-eligible at trust weight 0.3, connecting back to
File 023's baselineEligible flag.

**baselineModelScore stored alongside score.** The spec says to keep
the scikit-learn logistic regression running alongside CodeBERT, not
instead of it, so the report can state "the transformer beats the
baseline by X". Storing both on every result makes the ablation
study a *query* rather than a separate experiment — at Tier 3 we can
compute the delta across thousands of real submissions instead of
re-running everything.

**cohortMeanShift and studentShift** are the stated research
contribution in two numbers. If the whole class shifted between
assignments the instructor taught something; if only this student
shifted, that is signal. Storing both lets the evidence view show
the comparison directly, which is the difference between an
accusation and an observation.

**Decision made:** match count capped in the detector, not the
schema. A schema-level array limit would reject valid data rather
than truncating it; truncation to the top-K is a policy decision
belonging where the ranking happens. Without a cap this would be the
unbounded-array anti-pattern from File 021 — in a 60-student cohort,
every pairwise comparison means 59 matches per result, mostly noise
near zero.

**Decision made:** denormalised assignment, course, student and
language. The review queue filters and sorts on these constantly,
and without them every page load is a join through Submission. Note
this is *purely* a query-cost argument, unlike provenance on
Submission — these are stable references, so the immutability
reasoning does not apply here.

**Commit:** `feat(api): add detection result with per-layer evidence and versioning`

## 2026-09-13 — Day 6 — File 026: apps/api/src/models/AuditLog.ts

**What we built:** The append-only audit trail — actor with a
snapshotted actorRole, an eleven-value dotted action vocabulary, a
polymorphic targetType/targetId pair, an optional course scope, a
Mixed before/after changes object, a reason string, and an explicit
`at` timestamp with Mongoose's own timestamps fully disabled. Two
compound indexes, and two hooks enforcing immutability.

**Why we built it:** DetectionResult records what the *system*
computed; this records what a *person* did. When a submission
reaches a disciplinary committee two separate questions get asked —
what evidence did the system produce, and who looked at it, when,
and what did they decide. Without the second, a faculty member could
dismiss a flag and later deny it. An evidence system whose own
operation is unauditable is not credible. The spec requires it in
three places: the contestability workflow, the faculty confirmation
that makes a take-home submission baseline-eligible, and weight
changes, since a weight change alters every subsequent score.

**Why a separate file:** Separate from DetectionResult by actor and
by immutability. A result has one mutable region — the review
subdocument — because the queue query would otherwise need a join.
An audit entry has none. Mixing mutable and immutable data in one
document means neither guarantee holds. Worth naming the
complementarity: DetectionResult.review holds the *current* state
and is fast to query; AuditLog holds the *history* and is complete.
Both, not either.

**Libraries introduced:** None new. First use of regex hook
registration, Schema.Types.Mixed, and selectively disabled
timestamps.

**Functions written:**
* The save guard — throws if !this.isNew, so creating works and
  re-saving a loaded document does not.
* The query guard — one regex registration covering eight middleware
  names (updateOne, updateMany, replaceOne, findOneAndUpdate,
  findOneAndReplace, deleteOne, deleteMany, findOneAndDelete). Both
  are needed because document middleware catches doc.save() while
  query middleware catches Model.updateOne(), which never loads a
  document at all.
* The toJSON transform — seventh and final instance before
  extraction at File 027.

**Concepts learned:** audit trail · polymorphic reference · refPath ·
Schema.Types.Mixed · markModified() · document vs query middleware ·
isNew · hash chain · operational log vs audit log

**Decision made — eleven actions, not everything.** No user.login, no
submission.uploaded, no result.viewed. Those are *operational* logs,
and logging every page view would mean thousands of entries a day
drowning the roughly fifty decisions that actually matter. pino at
File 027 handles operational logging, where entries are disposable
and high-volume. The test for inclusion: would a disciplinary
committee ask about this? "Who dismissed the flag?" yes. "Who viewed
the page?" no.

**Decision made:** dotted domain.verb namespacing. A flat vocabulary
drifts — three developers write "dismissed", "dismiss" and
"review_dismissed" for one event and the audit view cannot group
anything. The prefix also enables find({ action: /^baseline\./ }) to
retrieve every baseline change.

**Decision made — actorRole snapshotted.** Same immutability
argument as provenance on Submission: if a faculty member later
becomes admin, the entry must still say what authority they held at
the time. Populating actor would show their *current* role, which is
a subtly false statement about a past event. Two denormalisations
now, both for the same reason — a record must describe the
conditions it was created under, not the current configuration.

**Decision made — Mixed for changes, despite Mixed normally being a
smell.** The shape genuinely differs per action: weights_updated
carries { w1, w2, w3 }, escalated carries { status },
provenance_changed carries { provenance }. A union of eleven
subdocument schemas is considerable machinery for data that is only
ever displayed, never queried into. And Mixed's known trap — that
Mongoose cannot detect mutations inside it without markModified() —
only bites on updates, which this collection rejects entirely. The
weakness is neutralised by the immutability constraint.

**Decision made:** enum on targetType rather than free text. A typo
producing "DetetcionResult" would make that entry invisible to every
query, and a silent gap in an audit trail is worse than a loud
error.

**Decision made:** No refPath despite the polymorphic reference.
refPath would enable populate() across collections, which is
convenient — but the audit view shows *what happened*, and a target
that was later modified would populate with its *current* state,
contradicting the snapshot stored in changes. The stored before/after
is the truth; the live document is not.

**Decision made:** timestamps fully disabled in favour of an
explicit `at`. updatedAt on an append-only collection is a lie about
the data model — its presence implies the entry can be updated. And
an explicit field makes the timestamp something the code sets
deliberately rather than framework magic, which is worth one extra
line in a record whose whole value is trustworthiness.

**Decision made:** No IP address or user agent. Standard in
enterprise audit logs, omitted here because it is personal data with
no stated requirement, and collecting personal data "in case it is
useful" is poor practice in a system already handling sensitive
academic records.

**MAJOR LIMITATION — the hooks are a guardrail, not a guarantee.**
Three ways around them, and the test script demonstrates the first
rather than just describing it. (1) Model.collection.* bypasses
Mongoose entirely — our own scratch scripts have used
.collection.drop() — because middleware sits above the driver and
the driver API is still reachable. (2) mongosh bypasses the
application: anyone with database credentials can run
db.auditlogs.deleteMany({}). (3) MongoDB has no native immutability
— no append-only collection type, no write-once storage.

What real systems do: a **hash chain** (each entry stores the
previous entry's hash, so tampering breaks the chain and becomes
*detectable*), a **write-only database user** (the application can
insert but not delete), or **external log shipping** to append-only
storage. Recommendation taken: accept the limitation now and add a
hash chain at Tier 2 — about fifteen lines plus a verification
function, and it converts "we hope nobody tampered" into "tampering
is detectable", which is a genuinely different claim. Report wording:
"Append-only is enforced at the application layer through Mongoose
middleware. Anyone with direct database access can modify entries. A
hash chain, making tampering detectable rather than merely
inconvenient, is the identified next step."

**Connects to the File 019 transaction limitation.** We cannot
atomically write a DetectionResult update and an AuditLog entry.
That is exactly why the plan is AuditLog *last* — a crash between
them leaves a real change with no log entry, which is bad, rather
than a log entry for a change that never happened, which is worse
because it is a false record.

**Commit:** `feat(api): add append-only audit log`

## 2026-09-13 — Day 6 — File 027: apps/api/src/models/plugins.ts

**What we built:** A Mongoose plugin holding the JSON serialisation
rule shared by every model — strip __v, plus any model-specific
fields passed as { hide: [...] }. Eighteen lines replacing
forty-two, applied to all seven schemas.

**Why we built it:** The toJSON transform had been written seven
times, six lines each, differing only in which extra fields get
hidden — passwordHash in User, objectKey in Submission. But
duplication alone is not the argument. The real one is
forward-looking: the React frontend will receive { "_id": "6aa3..." }
and writing user._id throughout a React codebase is ugly, so
packages/shared-types will want `id`. That rename is a *global*
serialisation decision — seven edits with a chance to miss one, or
one line with a plugin.

**Plan correction:** I had said File 027 would be models/index.ts
*and* the place the transform gets extracted. Those cannot be the
same file. A Mongoose plugin must be applied before model() is
called, and each model file calls model() at import — so a plugin
living in index.ts would mean every model importing the barrel,
which imports every model. Circular. The plugin needs its own file,
imported *by* the models. Corrected: 027 plugins.ts, 028 index.ts,
029 seed.ts. Phase 1 grows from 10 files to 11.

**Rule of three, deliberately over-applied.** The threshold was met
at File 022, and I deferred until seven instances on purpose. With
three I would have been guessing at the variation axis; with seven
it is visible and exactly one wide — which fields to hide. The cost
of waiting was 24 duplicated lines; the cost of guessing wrong would
have been an abstraction shaped around the wrong thing.

**Libraries introduced:** None new. First use of Mongoose plugins —
which turn out to be nothing more than a function (schema, options)
=> void, applied with schema.plugin(fn, opts). No base class, no
registration, no interface. The plugin system is a convention rather
than machinery.

**Functions written:**
* `serialize(schema, options)` — configures the schema's toJSON to
  strip __v and every field in options.hide. Mutates the schema,
  returns nothing. No failure modes: a non-existent field name in
  hide is a silent no-op, since delete on a missing key is harmless.
  Constraint: must run before model() compiles the schema.

**Concepts learned:** Mongoose plugin · closure · nullish coalescing
(??) · toJSON vs toObject · virtual · DRY · rule of three

**Decision made:** Deliberately did NOT configure toObject, only
toJSON. toJSON fires on JSON.stringify(), which res.json() calls, so
it governs what *clients* see. toObject() is for internal
conversion, where we generally want the full document — server-side
code needs objectKey to generate presigned URLs at File 037, and
stripping it internally would break that in a way that is hard to
trace. The asymmetry is the point: hide fields on the way *out to a
client*, not on the way *into our own code*. Verified in testing.

**Decision made:** _id → id rename deferred. It would change every
API response shape today, before a frontend exists to consume it,
and would invalidate test expectations already written. The plugin
makes it a one-line change when the frontend needs it — which was
the whole justification for extracting.

**Decision made:** A plugin rather than a shared base schema.
Mongoose supports inheritance via clone() or discriminators, but
discriminators are for storing multiple types in one collection,
which is not our case. A plugin composes without imposing a
hierarchy.

**Decision made:** A plugin rather than a plain helper function
called in each file. Nearly identical in effect, but .plugin() is
the idiomatic Mongoose form and is the extension point other plugins
use — a softDelete plugin at Tier 2 would sit naturally alongside.

**Decision made:** `hide` as an array parameter rather than seven
per-model plugin functions. serializeUser, serializeSubmission and
so on would move the duplication rather than remove it.

**Small note on readability:** the call site now reads
`userSchema.plugin(serialize, { hide: ["passwordHash"] })`, which is
*more* informative than six lines of delete statements — it names
the intent directly. The indirection costs one jump to read the
mechanism and buys a clearer statement of purpose at every call
site.

**Also note:** `import type { Schema }` rather than a plain import,
because Schema is used only as a type annotation here. That is the
verbatimModuleSyntax rule from File 008 — without `type`, tsx would
keep the import and Node would try to import an unused value.

**Confirmed working:** every model still hides __v; User still hides
passwordHash and Submission still hides objectKey; toObject() keeps
objectKey so server-side code is unaffected; and the transform still
applies through populate(), so a hidden field does not leak by being
reached indirectly.

**Commit:** `refactor(api): extract shared json serialisation into a mongoose plugin`

## 2026-09-14 — Day 7 — File 028: apps/api/src/models/index.ts

**What we built:** The model barrel — explicit re-exports of all
seven models, their inferred types, their hydrated document types
and their `as const` vocabularies — plus two helpers: initModels(),
which waits for every model's indexes to finish building, and
clearAllCollections(), a guarded test and seed helper. Wired
initModels() into server.ts between connectDb() and listen().

**Why we built it:** Two jobs. One import instead of seven at each
call site, and more importantly one place that knows what the model
layer contains. But the real reason is initModels(). At File 020 the
unique index did not fire because Mongoose builds indexes
asynchronously in the background and our insert won the race; we
fixed it with await UserModel.init(), and every scratch script since
has repeated that once per model — and forgotten it at least twice.
Until now nothing called init() at startup at all, so a fresh
deployment would accept uploads before its unique indexes existed
and duplicate attempt numbers would pass silently.

**Why a separate file:** Separate from plugins.ts — that is
behaviour applied *to* schemas, this is an inventory *of* models —
and merging them would be circular, since the models import
plugins.ts and this imports the models. Separate from db/connect.ts
because connecting and registering models are different concerns;
connect.ts is a leaf importing no model, so a test can open a
connection without loading the schema layer.

**Libraries introduced:** None new. First real use of Promise.all.

**Functions written:**
* `initModels()` — Promise.all over Model.init() for all seven.
  Rejects on the first index-build failure; server.ts catches and
  exits 1.
* `clearAllCollections()` — Promise.all over deleteMany({}) behind a
  NODE_ENV guard. Empties collections but keeps indexes.

**Concepts learned:** barrel file · re-export · tree-shaking ·
Promise.all · Promise.allSettled · index build race · tripwire vs
lock

**Why the file both re-exports and imports the models:** re-exports
do not bring names into local scope — `export { X } from "./Y.js"`
forwards X without making it usable here — so initModels() needs
real imports to get the values.

**Decision made:** Promise.all rather than sequential awaits.
init() is I/O-bound, so seven sequential awaits means seven round
trips instead of one. The failure semantics matter too: Promise.all
rejects as soon as any promise rejects and does not cancel the
others, which is exactly right here — a failed index build means a
broken constraint and the server should refuse to start rather than
run with partial enforcement. Promise.allSettled would report every
failure, which is better diagnostics but loses fail-fast.

**Decision made:** Model.init() rather than mongoose.syncIndexes().
syncIndexes also *drops* indexes not present in the schema —
convenient in development, genuinely dangerous in production, where
an accidental schema edit would drop a live index and silently
degrade every query using it. init() only builds what is missing.

**Decision made:** initModels() wired into server.ts rather than
called on import. Index building is slow I/O that can fail, and a
test merely importing a model should not trigger it. Same reasoning
as connectDb() at File 019, and deliberately the opposite of env.ts,
which *does* run on import because validation is instant and must
precede everything.

**Ordering:** connect → build indexes → bind the port. The server
must not accept a request before its constraints exist.

**Also changed in server.ts:** the bare `catch {}` around connectDb
now logs the actual error. The original swallowed it, which would
have made an index-build failure invisible — and that is precisely
the error most likely to surface at this point.

**Decision made:** explicit re-exports rather than `export *`. One
line versus thirty, but export * hides what is exported, so reading
this file would tell you nothing about the model layer, and it
silently forwards anything a model file adds later including things
meant to stay internal. Explicit is worth the thirty lines — being
the inventory is this file's job.

**Decision made:** named exports rather than a `models` object.
models.User is no shorter than UserModel, and it defeats
tree-shaking, since a bundler can drop an unused named export but
cannot reason about object properties. Irrelevant on the server
today, relevant when packages/shared-types is shared with the
frontend.

**The `as const` arrays are re-exported too** — LANGUAGES,
PROVENANCE, SUBMISSION_STATUS, LAYER_STATUS, REVIEW_STATUS,
AUDIT_ACTIONS, AUDIT_TARGETS and DEFAULT_DETECTION_CONFIG. That
matters because File 031's Zod schemas need them, so one import now
gives the model, its type and its vocabulary. This is the File 022
pattern reaching its intended shape: one declaration serving the
database, the type system and the API boundary.

**Honest limitation on the production guard:** it reads
process.env.NODE_ENV directly rather than the validated env from
File 009, deliberately — importing env.ts here would make the model
layer depend on configuration, and env.ts exits the process on
invalid config, which would be a harsh side effect of importing a
model. The cost is that if NODE_ENV is unset the guard does not
fire. It is a tripwire, not a lock — the same honest framing as the
AuditLog hooks. The real protection is that production credentials
should not be in a developer's .env at all.

**Decision made:** deleteMany rather than drop() in
clearAllCollections. The File 023 lesson — drop() returns before the
drop completes, so a following init() races it and MongoDB refuses
with IndexBuildAborted. deleteMany leaves indexes intact, confirmed
in testing: nine submission indexes survived a clear, and a unique
constraint fired immediately afterwards.

**Commit:** `feat(api): add model barrel with index initialisation at startup`

## 2026-09-14 — Day 7 — File 028 (fix): two guards colliding

**Battle — clearAllCollections() could not clear the AuditLog.**
The helper called deleteMany on all seven models. File 026's query
middleware rejects deleteMany by design, so the helper threw on its
own audit log with "AuditLog is append-only; updates and deletes are
not permitted".

**The guard was right.** At the Mongoose layer a test cleanup and a
tamper are the same operation — the hook cannot tell them apart.

**Fix:** Model.collection.deleteMany() for all seven, going to the
native driver below the middleware. Not a hack: File 026 had already
documented .collection.* as the boundary of the guarantee. The
workaround and the limitation are the same fact, which is worth
saying plainly in the viva — anything that can clear a test database
can also tamper with a production audit log. Added
.catch(() => undefined) because the native deleteMany throws
NamespaceNotFound on a collection that does not exist yet, and a
collection that does not exist is already empty.

**Second bug, same file — TS2740 on deleteMany({}).** TypeScript
could not narrow a union of seven different model types, so
m.deleteMany resolved to an unusable intersection. Fixed by
annotating the array as Model<unknown>[] — both init() and
deleteMany({}) exist on every model regardless of its document type,
so that is all the type the array needs.

**Commit:** `fix(api): type the model array and bypass audit-log guard when clearing`

## 2026-09-15 — Day 8 — File 029: apps/api/src/scripts/seed.ts

**What we built:** A deterministic seed script — 1 admin, 2 faculty,
30 students, 2 courses (one with a DetectionConfig override), 3
assignments (1 invigilated, 2 take-home), roughly 83 submissions
drawn from four source variants, a detection result per take-home
submission with computed RPS and attenuation, and three audit
entries. Plus an `npm run seed` script.

**Why we built it:** Seven collections and an empty database. Every
screen from here — review queue, evidence view, student dashboard —
needs data to render against, and hand-creating 30 students through
a UI that does not exist yet is impossible. Three things it buys: a
working review queue on day one of Phase 7 rather than building the
UI blind; shared reality across four people, so "works on my
machine" becomes checkable; and a reproducible demo in two commands.

**Why a separate file:** Separate from the models because it *uses*
them. Separate from tests because tests need tiny precise fixtures
created inline so each test reads as a self-contained statement,
while seed data is large and realistic — sharing them would make
tests depend on a 200-line dataset that breaks whenever a student is
added.

**Why src/scripts/ rather than a root scripts/:** forced by
tsconfig. File 008 set rootDir "src" and include ["src/**/*.ts"], so
a file outside src is neither type-checked nor compiled. Honest
consequence: it ships in the production image as dist/scripts/
seed.js, about 3KB of dev tooling in production — the same instinct
File 012 rejected when excluding the Dockerfile from its own image.
The alternative is a second tsconfig to maintain. Shipping 3KB beats
maintaining a second compiler configuration, but name it in the
report rather than pretending it is clean.

**Libraries introduced:** None new. node:crypto for SHA-256 hashes;
Mongoose's Model.create() with an array for bulk insert, which is
one round trip rather than thirty.

**Functions written:**
* `makeRng(seed)` — returns a deterministic PRNG closure
  (mulberry32).
* `pick(xs)` — generic, returns a random element typed as the array's
  element type.
* `between(lo, hi)`, `round2(n)` — range and rounding helpers.
* `variantFor(i)` — selects one of four source templates by index.
  Deterministic rather than random, so the duplicate and rename
  distribution is exactly reproducible.
* `sha256(s)` — hex digest.
* `seed()` — the script. Any rejection propagates to the bottom
  handler, which logs, disconnects and exits 1.

**Concepts learned:** seed data / fixture · deterministic PRNG ·
mulberry32 · generic function · bulk insert · idempotence

**Decision made — a seeded PRNG rather than Math.random().** With
Math.random, two teammates running npm run seed get different data:
her review queue has different students at the top, and a bug one
sees the other cannot reproduce. "Works on my machine" becomes
literally true and completely useless. A seeded generator gives
byte-identical data on every machine, forever. Worth contrasting
with File 005, where JWT secrets used a cryptographically secure
generator precisely because unpredictability was the point. Same
tool category, opposite requirement.

**Decision made:** hardcoded names and code samples rather than
@faker-js/faker. Faker would be a dependency for something forty
lines of arrays solve, its output is not deterministic without extra
configuration, and it cannot produce AST-similar Python variants —
which the code samples have to be anyway.

**The four source variants each exercise a different path:** BASE
used twice gives byte-identical submissions for the contentHash
short-circuit; RENAMED is level 1 of the obfuscation harness
(AST-identical after normalisation, text-different); REFORMATTED is
level 2 (whitespace only); INDEPENDENT is a genuinely different
approach using a generator expression, as the control case. The
i % 11 distribution makes roughly 9% exact copies and 9% renames —
realistic proportions, because most students write their own work
and the queue should reflect that rather than being uniformly
suspicious.

**Decision made:** realistic distributions rather than uniform data.
Every RPS at 0.5 would let us build a queue UI that looks fine and
breaks on real data. 15% skipped baselines, a long tail of low
scores, a handful above threshold — layout and threshold problems
become visible now rather than in Phase 7.

**Mitigation 2, seeded correctly:** baselineEligible is true only
for invigilated submissions. Take-home work is false — evaluated
against the baseline but never joining it without faculty
confirmation. That makes the data honest: most students have one
anchor against a minAnchorsForBaseline of 3, which is why roughly
15% of results have behavioral.status "skipped" with a stated
reason.

**Mitigation 3, computed rather than faked:** effectiveW2 scales
linearly with baselineConfidence when it falls below 0.4, so the RPS
leans on Layers 1 and 3. One line matters —
`effectiveW2 * (behavioral ?? 0)`. A skipped layer has no score, and
undefined * 0.09 is NaN, which would propagate and produce rps: NaN.
That NaN risk is exactly why File 025 made score optional rather
than defaulting to 0: the schema records ignorance honestly and the
aggregator handles it explicitly. Defaulting to 0 in the schema
would have hidden the distinction and made this line unnecessary, at
the cost of the evidence view being unable to say "we do not know".

**Decision made:** rollNo omitted entirely for faculty, not set to
null. The File 020 sparse-index sharp edge — a sparse index skips
documents *missing* the field, while an explicit null is a value and
enters the index, so a second null collides with E11000. Two faculty
in the seed proves it.

**Known temporary state:** PLACEHOLDER_HASH, because bcrypt arrives
in Phase 2. Deliberately not an invented bcrypt-format string — one
that looks like a hash and silently fails every comparison is worse
than one that obviously is not a hash. Greppable, and a scheduled
revisit: when utils/password.ts exists this becomes
await hashPassword("seed-password-123").

**Ordering inconsistency flagged rather than silently fixed:** the
seed writes the AuditLog entry *before* the DetectionResult update,
which is the opposite of the File 019 plan (AuditLog last, so a
crash leaves a real change with no log entry rather than a log entry
for a change that never happened). Harmless in a seed script, since
a crash means re-running from scratch — but File 045's controller
must do it the other way round, and having the wrong order in code
someone might copy is a real hazard. Recorded here deliberately.

**Decision made:** clear-then-insert rather than upsert. Upserting
would be idempotent without wiping, but it means matching on natural
keys and reconciling partial data. Clearing is simpler and honest
about what it does — hence the NODE_ENV guard inherited from
File 028's clearAllCollections.

**Decision made:** No BullMQ jobs enqueued. The queue arrives in
Phase 3, and seeding jobs for a worker that does not exist would
leave Redis holding entries nothing will ever consume.

**Phase 1 complete.** 11 files. Seven collections with validated
schemas, compound and sparse and multikey indexes, an append-only
audit trail, a shared serialisation plugin, a barrel with startup
index initialisation, and a deterministic dataset to build against.

**Bug found on first run:** exact-duplicate count was 30 of 51, not
the expected ~5. RENAMED and REFORMATTED had no per-student suffix,
so every student sharing an i % 11 bucket produced byte-identical
source and the hash short-circuit fired on all of them. Fixed by
appending "# student N" to both. Arguably more correct anyway:
levels 1 and 2 of the obfuscation harness exist to test whether AST
analysis catches what hashing misses, and if they are byte-identical
the hash short-circuits and Layer 1 never runs — defeating the point
of including them.

**Second bug, found by actually counting.** After adding the
"# student N" suffix the duplicate count was still 26 of 51, not the
expected handful. The arithmetic explains it exactly: variantFor(i)
took only the student index, so hw1 and hw2 received identical
source for the same student, and byHash was global across both
assignments — so every student's second submission was flagged as a
duplicate of their first. 30 students with i % 11 buckets gives 25
distinct sources; 51 submissions from 25 sources is 26 duplicates.

**It was also a design mismatch.** File 023's short-circuit query is
scoped to one assignment, because File 022 established that
comparing a sorting exercise against a graph traversal is
meaningless. The seed's global byHash was doing exactly that.

**Fixed three ways:** variantFor now takes an assignment tag so the
source differs per assignment; byHash is keyed
`${assignment}:${hash}` to match the real query's scope; and
takehomeSubs carries the assignment, which also fixed a separate bug
where every DetectionResult hardcoded `assignment: hw1._id`, so
results for hw2 submissions claimed to belong to hw1.

**Lesson — verify counts against arithmetic, not intuition.** The
first fix looked right and the number stayed wrong. Working out what
the count *should* be (submissions minus distinct sources) located
the cause in one step, where guessing would not have.

**Also learned about seeded PRNGs.** After the first fix the flagged
count went *up*, from 30 to 34, which looked like a regression. It
was not: `const structural = twin ? 1 : round2(between(...))` skips
the between() call when a twin exists, so fewer duplicates means
more random draws, which shifts the entire downstream sequence.
Determinism means "same code, same output" — not "small code change,
small output change." Comparing counts across a code change tells
you nothing.

**Commit:** `feat(api): add deterministic seed script with realistic detection data`

## 2026-09-15 — Day 8 — File 030: apps/api/src/utils/AppError.ts

**What we built:** A custom error class carrying an HTTP status, a
machine-readable code from a fourteen-value `as const` vocabulary,
an isOperational flag and optional details. Eleven static factories
for the cases we actually raise, and an isAppError type guard.

**Why we built it:** The API had no way to fail properly — throwing
anything gave Express's default 500 with a stack trace, the state
flagged as "unacceptable in production" at File 010. A plain Error
carries only a message, so a handler seeing "Course not found" has
no idea whether that is a 404 (genuinely absent) or a 403 (exists,
but not yours). In an academic-integrity system that difference is a
real information leak: a 404 tells you nothing, a 403 confirms the
resource exists.

**Why a separate file:** Separate from File 031's error handler by
role — this defines *what an error is*, that defines *what to do
with it*. Controllers import this and never touch the handler, and
tests can assert on an AppError with no HTTP layer. In utils/ rather
than middleware/ because it is a value type, not a function with the
(req, res, next) signature.

**Libraries introduced:** None. Pure TypeScript, and the first file
in the project with zero imports — a true leaf, importable anywhere
with no cycle risk.

**Functions written:**
* The constructor — super(message), assigns statusCode, code and
  details, then fixes the stack origin. Cannot fail.
* Eleven static factories, each returning a pre-configured instance.
  Pure, no side effects.
* isAppError(err) — a type guard returning `err is AppError`.

**Concepts learned:** custom error class · operational vs programmer
error · static factory method · type guard / type predicate ·
Error.captureStackTrace · error envelope · user enumeration ·
readonly

**Why codes as well as HTTP statuses:** statuses are too coarse. A
401 could mean no token, an expired token or a malformed token, and
the frontend must respond differently to each — TOKEN_EXPIRED
triggers a silent refresh while TOKEN_INVALID forces a re-login.
With only the status, the frontend would have to match on message
text.

**isOperational, and why it matters.** It distinguishes expected
failures we chose to raise (a missing submission, an expired token,
an oversized file — the system working correctly and saying "no")
from genuine bugs. That drives three different behaviours in the
handler: log at warn versus error; send the real message versus
"something went wrong"; omit versus log the full stack. The client
must not see a programmer error's message because a stack trace
leaks file paths and library versions, and "Cannot read property
'passwordHash' of undefined" hands an attacker our field names.
Same secure-by-default reasoning as select: false at File 020.

**Error.captureStackTrace(this, this.constructor)** — without it the
first stack frame is `at new AppError`, the constructor, which is
never where the bug is. The second argument tells V8 to start the
trace above the constructor so the top frame is the real throw site.
A V8-specific API, so Node and Chrome only; safe here, and it would
throw in a non-V8 runtime.

**Decision made — static factories rather than a bare constructor.**
Shorter at the call site, but the real benefit is that invalid
pairings become unconstructable. Nothing stops
`new AppError(200, "NOT_FOUND", ...)` — a 200 response announcing a
failure. The factories name each valid combination once, the same
argument as the `as const` arrays.

**Two factories carry security decisions in their signatures:**
* `notFound(resource)` takes a resource *type*, never an id, so the
  message is "Course not found" and never "Course 6aa3e707 not
  found". Echoing the id confirms the guess was well-formed.
* `unauthenticated()` defaults to a vague "Authentication required"
  and will be used for *both* an unknown email and a wrong password
  at File 038. If those differed, an attacker could enumerate every
  valid institutional email by reading which error came back — a
  list worth having for phishing. There is a subtler timing leak,
  since the wrong-password path runs bcrypt and the unknown-email
  path does not, but that is File 038's problem.

**Decision made:** No 500 factory. A 500 is by definition
unanticipated — the handler produces them for non-AppError throws.
A static internal() would invite marking genuine bugs as
operational, hiding them from the logs.

**Decision made:** `details` typed unknown rather than any. Forces
the handler to decide how to treat it rather than silently
serialising something unexpected. Note the contrast with File 029,
where I used unknown for values whose type I knew — that was wrong.
Here the type genuinely varies by error. unknown is right when you
actually do not know, and lazy when you do.

**Decision made:** an `as const` array rather than a TypeScript
enum. A TS enum generates a runtime object and has known pitfalls
with const enum and bundlers; `as const` gives the same union type
with a plain array the frontend can import and iterate. Fifth use of
this pattern after LANGUAGES, PROVENANCE, SUBMISSION_STATUS and
AUDIT_ACTIONS.

**Decision made:** isAppError as a function rather than inline
instanceof. One place to change if the check needs to get cleverer —
instanceof compares prototype chains and fails if two copies of a
module are loaded, which some bundler configurations allow. If that
happens it becomes a duck-type check on code and statusCode, and
only one line changes.

**Correction — captureStackTrace does less than I claimed.** I said
the first stack frame would be the throw site. It is not: it is the
static factory, because captureStackTrace removes frames up to and
including the *constructor*, and `AppError.notFound` sits above it.
Verified: the throw site is the *second* frame. Fixing it properly
would mean an extra captureStackTrace call inside all eleven
factories — eleven lines to remove one frame from a trace that
already contains everything needed. Left as is, with a comment.
Lesson repeated from the floating-point example at File 024: verify
what a mechanism actually produces, not what you expect it to.

**Commit:** `feat(api): add typed application error with status codes and factories`

## 2026-09-15 — Day 8 — File 031: apps/api/src/middleware/errorHandler.ts

**What we built:** The single funnel for every error — four
translators (AppError, ZodError, Mongoose ValidationError, MongoDB
E11000, plus CastError), one response envelope, a per-error request
ID, and operational-versus-programmer logging. Plus a notFoundHandler
that routes unmatched routes through the same funnel.

**Why we built it:** File 030 gave us a way to *raise* errors; this
is where they land. An unhandled error previously produced Express's
default 500 with a full stack trace in the response body, leaking
file paths, Node and library versions, and field names. But the more
interesting job is reconciliation: errors arrive in four
incompatible shapes, and File 020 proved the first two are genuinely
different — an invalid role gives a Mongoose ValidationError while a
duplicate email gives a MongoDB E11000. A client should not have to
know which of our internal libraries produced a failure.

**Why a separate file:** Separate from AppError by role — that
defines *what an error is* and has zero imports; this defines *what
to do with it* and imports Express, Zod, Mongoose and AppError.
Separate from app.ts because it is registered there but defined
here, the same split as route files. In middleware/ because it
genuinely is middleware, and a specific kind.

**Libraries introduced:** None new. First use of Express's
Request/Response/NextFunction types (import type, per
verbatimModuleSyntax), ZodError, and Mongoose's Error namespace
renamed on import because `Error` would shadow the global.

**Functions written:**
* errorHandler(err, req, res, next) — classifies any thrown value,
  logs appropriately, sends one envelope. Cannot fail: if every
  branch misses, the 500 defaults apply.
* notFoundHandler(req, res, next) — converts an unmatched route into
  an AppError and calls next(err).
* isDuplicateKeyError(err) — a type guard, duck-typed on code ===
  11000 rather than instanceof, because the driver's error class is
  not reliably exported across versions.
* fromZod, fromMongooseValidation, fromDuplicateKey — pure
  translators, separate so the main handler stays a flat else-if
  chain and each can be unit-tested without HTTP.

**Concepts learned:** error middleware · arity · error envelope ·
request ID / correlation ID · CastError · keyPattern vs keyValue ·
duck typing · destructuring assignment to existing variables ·
fail-closed

**The four-parameter rule, and the trap in it.** Express counts
parameters to decide what a function is — three means normal
middleware, four means error middleware. It reads fn.length at
registration time. So removing the unused `_next` silently turns
this into normal middleware: it stops receiving errors, every
failure falls through to Express's default handler, and nothing
tells you why.

**err typed unknown, not Error.** JavaScript lets you throw
anything — a string, a number, null. Typing it Error would be a lie,
and unknown forces every branch to prove what it is holding. Same
reasoning as catch (err) under strict at File 019. Confirmed in
testing: a thrown string produced a clean 500 rather than crashing
the handler.

**Two libraries, two shapes, one output.** Zod 4 exposes .issues (an
array, each with a path array and a message) while Mongoose stores
failures in an .errors *object* keyed by field path, so Object.values
gets the list. Both translate to the same { field, message }[] under
VALIDATION_FAILED. That reconciliation is the point of this file.

**Decision made — never echo the duplicate value.** MongoDB's E11000
carries both keyPattern (which index) and keyValue (the actual
value). We use only keyPattern. If registration returned "A record
with email sam@invertis.ac.in already exists", that is user
enumeration through a different door — the exact leak
AppError.unauthenticated() closes on the login path. Naming the
*field* is enough for the frontend to highlight the right input;
echoing the *value* confirms an account exists. fields.join(" and ")
handles compound indexes, so the { code, academicYear } index from
File 021 produces both names.

**Decision made:** CastError gets its own branch. Mongoose throws it
when a string cannot be cast to a schema type — in practice, someone
requesting /api/courses/not-an-objectid. That is a malformed
request, not a server fault, so 400 rather than 500. Without the
branch it would fall through to the generic 500 and be logged as a
bug, filling the error stream with noise from ordinary bad input.

**The operational flag driving three behaviours.** This is
File 030's isOperational doing its work: log at warn versus error,
omit versus log the full stack, and send the real message versus
"Something went wrong". The client gets nothing specific on a 500
because a stack trace leaks absolute file paths (revealing directory
structure and username), library versions (so an attacker can look
up known CVEs), and field names. And warn rather than error for
operational failures matters because a student requesting a
submission they do not own is the system *working correctly* — if
those logged at error, a real bug would be invisible in the noise.
Same reasoning as console.warn for a dropped Mongo connection at
File 019.

**Development escape hatch, with two safety properties.** In
development the real message is attached as details.devOnly, so we
are not switching to the terminal for every failure in Postman. It
is gated on env.NODE_ENV — the *validated* value from File 009, not
raw process.env — so a missing or malformed NODE_ENV crashes at
startup rather than silently enabling this in production. And it
attaches only the message, never the stack, so a screenshot of a dev
response cannot leak paths.

**File 010 revisit:** the inline 404 handler was replaced.
notFoundHandler calls next(AppError.notFound(...)) rather than
responding directly, so an unmatched route produces the identical
envelope as every other error. The old version returned
{ error: "Not found" } with `error` as a *string*, while everything
else returns an *object* — a frontend would have had to handle both.
Ordering is absolute: notFoundHandler then errorHandler, both after
every route.

**Known limitation — the request ID is generated at error time**, so
it only exists on failures. A proper implementation attaches one to
every request in middleware, so successful requests are traceable
too. Small addition at File 032, since pino has request-ID support
built in.

**Known temporary state:** console.warn and console.error rather
than structured logging. pino at File 032 swaps them, and adds
redaction so a password or token can never reach the logs.

**Deliberately not translated here:** multer errors (Phase 3 — the
codes exist in AppError for when that lands) and jsonwebtoken errors
(File 034 — they will be caught in the auth middleware and
re-thrown as AppError.tokenExpired(), translating at the source
because only the middleware knows whether an expired token means
"refresh" or "reject").

**Commit:** `feat(api): add central error handler reconciling four error shapes`

## 2026-09-15 — Day 8 — File 032: apps/api/src/config/logger.ts

**What we built:** A shared pino logger configured from env — level
from LOG_LEVEL, ISO timestamps, a service field on every line,
pino-pretty in development only, and nineteen redaction paths. Plus
componentLogger(), returning a child logger with a component field
bound. Replaced every console call in db/connect.ts,
middleware/errorHandler.ts and server.ts.

**Why we built it:** Three reasons. console.log produces
unsearchable prose — "403 FORBIDDEN GET /app-error" cannot answer
"show me every 403 for this student in the last hour" without a
regex against English. There is no runtime-filterable severity, so
the warn-versus-error distinction from File 019 exists only by
convention. And redaction: in two files we handle passwords and in
three, JWTs, and the commonest way a credential leaks is not an
attack but a developer logging a request body while debugging.
Redaction makes that mistake harmless — the logger refuses to print
password, token or authorization regardless of what it is passed.
The mechanism has to exist *before* the code that handles secrets,
or adding it means auditing every call site.

**Why a separate file:** In config/ beside env.ts because logging is
configuration — level, format, redaction paths — and it imports env,
so it is not a leaf. Separate from errorHandler because logging is
not error handling; the handler is one consumer among several.

**Libraries introduced:**
* `pino` — a structured JSON logger optimised for throughput. Chosen
  over winston, which has more transports and more configuration
  surface and is measurably slower; winston's flexibility solves
  problems we do not have, while pino's redaction is the feature we
  actually need.
* `pino-http` — installed but unused until File 037.
* `pino-pretty` — devDependency. Development-only terminal
  formatting.

**Functions written:** componentLogger(component) — returns
logger.child({ component }), so every line from that module carries
the field without repeating it. The module body runs once at import,
constructing the logger and opening its transport — a deliberate
side effect on import, like env.ts.

**Concepts learned:** structured logging · log level · redaction ·
child logger · transport · NDJSON · serialiser · non-enumerable
property · spread-a-conditional-object

**LOG_LEVEL finally does something.** It has been in .env since
File 005 and validated since File 009. The hierarchy is trace, debug,
info, warn, error, fatal, and a level below the threshold is never
*serialised* at all rather than filtered later — which is where
pino's speed comes from. fatal is new: it means the process is about
to die, which is exactly server.ts's uncaught-exception and
startup-failure paths, and monitoring treats it differently from
error.

**Redaction, and its honest limitation.** Nineteen paths in three
forms: literal keys, wildcards like *.password to catch one level of
nesting, and bracket notation for res.headers['set-cookie'] because
a hyphen is not valid in a dotted path. req.headers.authorization is
the most important — every authenticated request carries a bearer
token, and logging a request object once without redaction writes a
valid, still-usable token to disk. But redaction is **path-based,
not value-based**: log a token under a key not in the list and pino
has no idea what it is. It is a safety net for the obvious mistakes,
not a guarantee. Same honest framing as the AuditLog hooks at
File 026 — name the boundary rather than overclaim. Demonstrated in
testing with a `credential` key that was not redacted.

**Two pino gotchas worth remembering:**
* The signature is log.level(mergingObject, message) — the object
  comes *first*, the reverse of console.log. Getting it backwards
  produces "[object Object]" as the message text.
* The error key must be exactly `err` for the built-in serialiser to
  fire. { error: err } serialises as {} because Error's message and
  stack are non-enumerable properties, which JSON.stringify skips.
  Confirmed in testing, and it is the kind of thing that costs
  twenty confused minutes once.

**Decision made:** ISO timestamps rather than pino's epoch-millis
default. The default exists because generating a number is faster
and pino optimises hard for throughput, but at our volume that is
the wrong trade — we read these logs directly in a terminal, and
1758024293115 is not legible.

**Decision made:** pino-pretty in development only, and not merely
for aesthetics. It runs in a worker thread and adds overhead, and
log aggregators expect newline-delimited JSON, so pretty output
would have to be re-parsed badly. Configured with a
spread-a-conditional-object so the transport key simply does not
exist in production.

**Decision made:** stdout rather than a file transport. Twelve-Factor,
and Docker already collects stdout — a file inside a container dies
with the container and would need volume mounts and rotation. Same
principle as config-in-the-environment at File 005.

**Decision made:** one shared instance rather than a factory. The
transport should open once per process, not per import.
Deliberately the opposite of createApp() at File 010, for a concrete
reason rather than inconsistency.

**Decision made:** left initModels()'s console.log alone. Importing
config/logger.ts into the model layer would mean a test that merely
imports a model constructs a logger and opens a transport. One
inconsistency is cheaper than that coupling.

**Deferred:** pino-http is installed but not wired. Per-request
logging means touching app.ts's middleware order, and doing that
alongside this file's three revisits is too much at once. File 037
is the natural point — the validate middleware lands there and
app.ts is being edited anyway — and it is also where the request-ID
gap noted at File 031 gets closed properly, since the ID should be
attached to *every* request rather than generated at error time.

**Commit:** `feat(api): add structured logging with credential redaction`

## 2026-09-15 — Day 8 — File 033: apps/api/src/utils/password.ts

**What we built:** bcrypt hashing at cost factor 12, with length
validation in bytes, a verify that returns false rather than
throwing on a malformed hash, a fakeVerify() that equalises login
timing, and needsRehash() for future cost upgrades. Replaced the
seed's PLACEHOLDER_HASH with a real hash.

**Why we built it:** We cannot store passwords, only something that
lets us *check* one. Plaintext means a leaked backup or a
misconfigured bucket hands over every student's password — and
because people reuse passwords, their email accounts too. A plain
fast hash is not enough either: SHA-256 is deliberately fast, so a
GPU computes billions per second and a dictionary attack recovers
weak passwords in minutes. bcrypt is deliberately *slow* and its
slowness is tunable.

**Why a separate file:** The File 020 argument — a model defines
what a user *is*; hashing is a behaviour operating on one. In the
model, every file importing User would pull in a native module and
user.save() would become unpredictably slow in a way the call site
cannot see. Separate from authController because these are pure
functions with no HTTP, unit-testable without a request or a
database.

**This is where File 020's decision came due.** I rejected a
pre("save") hashing hook there with a stated trade-off: the hook is
safer against forgetting, and we accepted a small risk for an
explicit cost. File 038 is the one place that must not forget.

**Libraries introduced:**
* `bcrypt` — adaptive password hashing. Chosen over SHA-256/MD5
  (fast by design, which is the whole problem) and over bcryptjs
  (pure JavaScript, ~3x slower, which forces a lower affordable cost
  and therefore weaker hashes). **Honest note on argon2:** argon2id
  won the 2015 Password Hashing Competition and is memory-hard,
  resisting GPU and ASIC attacks better than bcrypt. It is the
  technically better choice. We chose bcrypt for two decades of
  deployment without a practical break, better ecosystem support,
  and a single tunable parameter rather than three interacting ones
  (time, memory, parallelism). Name it in the report as a considered
  trade-off, not an oversight.
* `@types/bcrypt` — DefinitelyTyped; bcrypt ships none.

**The File 012 decision paying off:** bcrypt is a native module with
prebuilt binaries targeting glibc. node:22-bookworm-slim was chosen
over Alpine specifically so this installs rather than compiling from
source.

**Functions written:**
* hashPassword(plain) — validates length, hashes at cost 12. ~250ms,
  deliberately. Throws AppError.validation outside the limits.
* verifyPassword(plain, hash) — returns boolean; a malformed hash
  returns false rather than throwing.
* fakeVerify() — burns the same ~250ms against a throwaway hash.
* needsRehash(hash) — reads the stored cost and reports whether it
  predates the current factor.

**Concepts learned:** hash function · salt · rainbow table · work
factor / cost · adaptive hashing · memory-hard function · timing
attack · constant-time comparison · hashSync · transparent rehashing
· k-anonymity

**Cost factor 12, and why not more or less.** bcrypt's cost is
exponential — 2^cost iterations — so 12 is twice the work of 11.
Roughly 65ms at 10, 250ms at 12, 1s at 14. Higher is not free: the
cost falls on *our* server on every login, so at 14 thirty students
logging in at 9am is thirty seconds of CPU, and it becomes a
denial-of-service vector. Lower quadruples an attacker's throughput.
The right cost is "as slow as users will tolerate", revisited as
hardware improves — which is what needsRehash exists for.

**No separate salt field, and that is not an oversight.** A salt is
random data mixed in before hashing so two users with the same
password get different hashes, defeating precomputed rainbow tables.
bcrypt generates one per call and *embeds* it in the output, along
with the algorithm variant and the cost:
$2b$12$<22-char salt><digest>. So compare() reads the cost from the
stored hash rather than being told it, and raising COST_FACTOR
tomorrow leaves every existing password verifiable. Older designs
stored a separate salt column, which works but is one more thing to
keep in sync.

**The 72-byte trap.** bcrypt silently *ignores* everything past 72
bytes — it truncates rather than erroring. A user with a
100-character passphrase would have only the first 72 bytes checked,
and anyone knowing those could log in with any suffix. We reject
instead, because silently weakening a password the user believes is
strong is worse than telling them it is too long. And the check uses
Buffer.byteLength, not .length: a JavaScript string's length counts
UTF-16 code units while bcrypt's limit is in *bytes*, so an emoji is
four and most Devanagari characters are three. Directly relevant for
an Indian university where a student might use Hindi or Urdu.
Confirmed in testing: 73 ASCII bytes rejected, 57 Devanagari bytes
accepted, 25 emoji (100 bytes) rejected.

**fakeVerify closes the timing leak flagged at File 030.** The vague
"Authentication required" message stops an attacker *reading* which
emails exist, but a naive login still leaks it by timing: an unknown
email returns in ~5ms while a wrong password takes ~255ms, because
only the second runs bcrypt. That 250ms gap is trivially measurable
over a network, so scripting a few thousand addresses yields a clean
list of registered accounts and the vague message buys nothing.
fakeVerify runs a real comparison against a throwaway hash so both
paths cost the same. The dummy hash is computed with hashSync once
at module load — blocking is acceptable there precisely because it
is before the server accepts requests, and would be a serious
mistake anywhere else.

**Honest limitation:** fakeVerify equalises the *bcrypt* cost, not
the *database* cost. A findOne that misses may be marginally faster
than one that hits. That residual is low single-digit milliseconds
against a 250ms baseline, far below network measurement noise, but
the report should say so rather than claiming the leak is fully
closed.

**Decision made:** verifyPassword returns false on a malformed hash
rather than propagating. A corrupted record producing a 500 while a
wrong password produces a 401 would identify which accounts have bad
data — a form of the same enumeration leak AppError.unauthenticated
closes.

**Decision made:** length-only validation here, no composition
rules. Current NIST guidance advises against "must contain a symbol"
requirements — they push users toward Password1! rather than genuine
entropy, and length matters far more. Full validation belongs in
File 036's Zod schema; this file enforces only what bcrypt itself
imposes.

**Future work named:** breach-list checking via Have I Been Pwned's
k-anonymity API would catch known-compromised passwords. Rejected
for now as an external HTTP dependency on the registration path, but
it is a genuinely good feature.

**File 029 revisit:** PLACEHOLDER_HASH became a real hash of
"codeguard-dev-2026". Hashed once and reused for all 33 seeded users
deliberately — hashing 33 times would add ~8 seconds to every seed
run for no benefit, since they share the password anyway.

**Redaction verified against real credentials.** File 032's
redaction was finally tested on what it exists to protect: a real
plaintext password and a real bcrypt hash, logged under five
different key paths. All five read [Redacted].

**Commit:** `feat(api): add bcrypt password hashing with timing equalisation`

## 2026-09-16 — Day 9 — File 034: apps/api/src/utils/jwt.ts

**What we built:** JWT signing and verification — separate access
and refresh tokens with their own secrets, HS256 with the algorithm
pinned on verify, registered claims (sub, iss, aud, exp, jti) plus
private role and type claims, error translation into AppError, and a
bearer-header parser. Plus the ROLES export added to User.ts.

**Why we built it:** HTTP is stateless, so something must let a
request say "I am Sam, and I logged in." A server-side session
stores { sessionId -> userId } and costs a lookup per request; a JWT
carries the claims inside itself, signed so they cannot be altered,
so the server reads the user id straight out. That matters here
because the spec requires one API serving both a React app and an
Android app — a token in an Authorization header works identically
for both, while cookie sessions are a browser mechanism.

**Why a separate file:** Separate from middleware/auth.ts by
concern — this answers "is this token valid and what does it say?",
a pure function over a string, while the middleware answers "should
this request proceed?", which involves req, res and HTTP semantics.
That split lets us unit-test expiry, tampering and type confusion
with no HTTP request, the same reasoning as password.ts. Separate
from authController because the controller *composes* these.

**Libraries introduced:**
* `jsonwebtoken` — signs and verifies JWTs. Chosen over `jose`,
  which is more modern and promise-based and supports the full JOSE
  suite including encryption, because jsonwebtoken is the ecosystem
  standard with far more examples and we need none of the extra
  surface. Critical usage note: always pass `algorithms` on verify.
* `@types/jsonwebtoken` — verified against the published package
  that jsonwebtoken ships no types of its own, the same situation as
  bcrypt.

**Functions written:**
* signAccessToken({ userId, role }) — 15-minute HS256 token.
* signRefreshToken({ userId, role }) — returns { token, jti }, 7
  days. The jti is returned so the caller can store it for
  revocation without decoding the token again.
* verify(token, secret, expected) — private. Checks signature,
  algorithm, issuer, audience and expiry, then the type claim and
  required fields.
* verifyAccessToken / verifyRefreshToken — thin wrappers binding the
  right secret and expected type.
* extractBearerToken(header) — returns the token or null, never
  throws.

**Concepts learned:** JWT · claim · registered claims · HMAC ·
symmetric vs asymmetric signing · alg:none attack · algorithm
confusion attack · token type confusion · bearer token · deny-list ·
TTL · satisfies

**The most important property: a JWT payload is base64, not
encrypted.** Anyone holding the token can decode and read it —
confirmed in testing by decoding the payload segment with no secret.
The one consequence: never put a secret in a JWT. Our claims are a
user id and a role, both of which the user already knows about
themselves. The signature is what makes it trustworthy, not
secrecy.

**Pinning `algorithms` on verify is not optional.** Omitting it
enables two well-known forgeries. The alg:none attack: the JWT spec
permits an algorithm named "none" meaning unsigned, so an attacker
edits the header to {"alg":"none"}, sets role to admin, and drops
the signature — a library that trusts the header accepts it. The
HS/RS confusion attack: with RS256 an attacker switches the header
to HS256 and signs with the *public* key, and a trusting library
uses that public key as an HMAC secret. Both work by making the
library trust the token's own claim about how it was signed. Pinning
means the header's alg is ignored. **Never let the token tell you
how to verify it.** Confirmed in testing: an alg:none forgery was
rejected.

**Decision made:** HS256 rather than RS256. Asymmetric signing
matters when a *separate* service must verify without being able to
sign; our detector never verifies tokens and only our API does
either. One fewer key to distribute.

**Decision made — a `type` claim as well as separate secrets.** The
attack: a refresh token lives 7 days while an access token lives 15
minutes, so without a type check a stolen refresh token presented as
an access token turns a 15-minute exposure into a 7-day one.
Separate secrets already prevent this, since a refresh token fails
verification against the access secret — but the type check is a
second independent mechanism that still holds if the two secrets
were ever accidentally set identical. Same defence-in-depth as
select: false plus the toJSON transform at File 020.

**Decision made — role inside the token.** It makes requireRole a
pure function with no database call, so every authenticated request
avoids a query. The cost is that the role is *frozen at login*:
demote a faculty member and their existing access token still says
faculty for up to 15 minutes. **That window is the entire reason the
access token is short-lived — the two decisions are one decision.**
An hour-long token would mean an hour of stale privileges. Honest
note for the report: a genuinely sensitive action, like changing
another user's role, should still re-read the user from the
database rather than trust the claim.

**jti now, deny-list later.** A JWT cannot be revoked before it
expires — there is no server-side record to delete. The standard
answer is a deny-list: on logout, store the refresh token's jti in
Redis with a TTL matching its remaining life, and check it on
refresh. That makes refresh stateful, which sounds like it defeats
the point and does not: the access token is verified on *every*
request with no lookup, while the refresh happens every 15 minutes
and pays one Redis check. Stateless where the volume is, stateful
where revocation is needed. Adding jti later would mean every
existing token lacks it, so two lines now.

**Honest counter-argument for the report:** server-side sessions are
*revocable immediately*; JWTs are not. We compensate with a
15-minute access token and a jti for refresh revocation, but "log
this user out now" is genuinely harder with JWTs. A real trade, not
a free win.

**Decision made:** issuer and audience checks. Low value today — we
run one API with secrets nobody else has — but they become valuable
with a staging environment alongside production, where a staging
token must not work against production data. Two lines, standard
practice, named as belt-and-braces rather than pretended essential.

**Error translation here, which File 031 deferred deliberately.**
TokenExpiredError becomes AppError.tokenExpired(); everything else
becomes tokenInvalid(). The distinction matters to a client:
TOKEN_EXPIRED means "your session is fine, refresh silently" while
TOKEN_INVALID means "something is wrong, log in again". Different
responses need different codes — exactly the argument for codes
alongside HTTP statuses at File 030. Everything else collapses to
tokenInvalid deliberately, because distinguishing "bad signature"
from "malformed" tells an attacker how close their forgery came.

**File 020 revisit:** added `export const ROLES = [...] as const` and
`export type Role`, the inconsistency noticed at File 022 when
Assignment.ts exported LANGUAGES the same way. Needed here, and by
requireRole and the auth Zod schemas.

**Deliberately not here:** refresh-token rotation (best practice is
to issue a new refresh token on every refresh and invalidate the
old, so a stolen token is detectable through reuse — but it needs
storage, so File 038), cookie versus header handling (File 038, with
the controller that sets the response), and the token deny-list
(needs Redis, Phase 3).

**Commit:** `feat(api): add jwt signing and verification with algorithm pinning`

## 2026-09-16 — Day 9 — File 035: apps/api/src/middleware/auth.ts

**What we built:** Four middleware functions — requireAuth (verify
the bearer token, attach req.user, no database call), optionalAuth
(attach if present, never fail), requireRole(...allowed) as a
factory, and requireActiveUser (one projected lean query, rejecting
deactivated accounts and correcting a stale role). Plus a
declare-global block adding req.user to Express's Request type.

**Why we built it:** File 034 can say whether a token is *valid*;
this decides whether a request may *proceed*. Two different
questions, and conflating them is a classic source of security
holes: authentication asks who you are and fails with 401,
authorisation asks what you may do and fails with 403. Without
middleware, every controller would repeat the same fifteen lines,
and the one that forgot would be an open endpoint we found out about
from an incident.

**Why a separate file:** Separate from utils/jwt.ts by the split
argued at File 034 — that is a pure function over a string, this
touches req, res and HTTP semantics. Separate from controllers
because it runs *before* them, so a controller can assume req.user
exists rather than checking.

**Libraries introduced:** None new.

**Functions written:**
* requireAuth — extract, verify, attach. Throws
  AppError.unauthenticated() with no token; verifyAccessToken throws
  on a bad one. Note there is no try/catch: Express 5 forwards a
  synchronous throw to the error handler automatically, which is the
  version note from File 007 paying off.
* optionalAuth — same, but swallows a bad token.
* requireRole(...allowed) — a higher-order function returning
  middleware, so roles can be configured per route.
* requireActiveUser — async, one query.

**Concepts learned:** authentication vs authorisation · declaration
merging · ambient declaration · higher-order function · rest
parameters · projection · .lean() · RBAC · role hierarchy · stale
claim

**Declaration merging, and why it is needed.** Express's Request
type lives in @types/express, in node_modules, and we cannot edit a
file we do not own. TypeScript merges two same-named interface
declarations rather than replacing one with the other, so
`declare global { namespace Express { interface Request { user?: ...
} } }` adds the field project-wide. `declare global` is required
because this file is a module and everything in it would otherwise
be module-scoped.

**Decision made:** req.user is optional, not an AuthenticatedRequest
type with user required. The precise version is more accurate and
means casting at every route registration, because Express's handler
types expect Request. Optional field plus a runtime check is the
common pattern; the awkwardness (req.user!.id in controllers) is
real but small.

**Decision made — no database lookup in requireAuth.** The role is
in the token precisely to avoid a query per request, which is the
File 034 decision executed. **Honest counter-argument for the
report:** at thirty students a findById is about 1ms and always
checking would be entirely affordable. The stateless design is a
*scalability* choice, not a performance necessity at our scale, and
we should say that rather than implying the lookup would be costly.

**requireActiveUser is the escape hatch, opt-in per route.** A JWT
cannot be revoked, so a user deactivated via isActive keeps working
for up to 15 minutes, and a demoted faculty member keeps faculty
access for the same window. For browsing a dashboard that is
acceptable; for escalating a flag to a disciplinary committee it is
not. Confirmed in testing: the *same* deactivated-faculty token
returns 200 on /faculty-only and 401 on /escalate, and the same
demoted token returns 200 on the token-only route and 403 on the
checked one. Those four lines are the honest picture of JWT
authorisation and are worth showing an examiner rather than claiming
the system is always current.

**Three details in requireActiveUser:** .select("role isActive") is
a projection fetching two fields rather than the whole document,
which also removes any risk of handling a password hash; .lean()
returns a plain object rather than a hydrated document, skipping
methods and change tracking we do not need for a read; and a stale
role is *corrected in place* rather than rejected, because a demoted
user should still be able to do student things.

**Ordering dependency worth noting:** requireActiveUser must come
*before* requireRole, or the role check runs against the stale
value. The type system cannot enforce that, so File 040's tests
should cover it.

**Decision made — no role hierarchy.** Admin is not automatically
granted faculty permissions; every route lists exactly who may
access it. A hierarchy would make routes read shorter, but an
implicit grant is invisible at the call site — reading
requireRole("faculty") you cannot tell whether admin is included
without checking the implementation. In a system where
authorisation decisions end up in a disciplinary record, explicit
beats concise.

**Decision made:** a misconfigured route throws a plain Error, not
an AppError. If requireRole runs without requireAuth, that is a
programmer error — a route wired wrongly — not something a client
did. File 031's handler turns a non-AppError into a 500 with a
generic message and a full stack in the logs, which is exactly
right: returning a 403 would hide a real bug behind a plausible
response and make the route appear to work.

**Decision made:** log 403s but not 401s. A 401 is noise —
logged-out sessions, expired tokens, bots probing. A 403 means
someone authenticated *successfully* and then tried something they
are not permitted to do, which is either a UI bug showing a control
it should not, or probing. The logged fields (userId, role, allowed,
url) make "which user is hitting 403s, and on what?" a query rather
than a regex — File 032's structured logging paying off.

**Deliberately not here:** ownership checks ("is this submission
yours?") and course-scoped permissions ("does this faculty member
own *this* course?"). Both need the resource, which the controller
is already fetching; putting them here would mean a second query.
Controllers handle ownership, middleware handles role. Rate limiting
is Phase 3, sharing the Redis store with upload limits.

**Possibly premature:** optionalAuth is not used by anything yet. It
is included because the review queue will likely want it — a page
whose content differs for a signed-in user without requiring one.
Seven lines, and the pattern is worth having named, but it is fair
to call it speculative.

**Commit:** `feat(api): add auth and role middleware with stale-token check`

## 2026-09-18 — Day 10 — File 036: apps/api/src/validation/authSchemas.ts

**What we built:** Four Zod schemas — registerSchema (public, no role
field), createUserSchema (admin-only, with role and two cross-field
rules), loginSchema (deliberately loose) and refreshSchema. Plus
reusable email, password and rollNo field schemas, and four inferred
types.

**Why we built it:** Every request body is untrusted input from the
internet, and TypeScript cannot help because types are erased at
compile time — req.body is `any` at runtime, so
req.body.email.toLowerCase() throws if someone sends
{"email": 42}. But the more important job is what this file refuses
to let a client decide: if registration accepted a role field,
anyone could POST {"role":"admin"} and grant themselves access to
every submission and detection result in the system. That is mass
assignment, and it caused GitHub's 2012 breach.

**Why a separate file:** Separate from the controller because a
schema is a *declaration*, not behaviour. Separate from the Mongoose
models even though both validate, because they guard different
boundaries: Mongoose guards the database and sees what our code
passes; Zod guards the HTTP boundary and sees what a stranger sends.
A Mongoose schema cannot stop a client sending role: "admin" — by
the time the model sees it, our controller has already decided to
pass it. New validation/ folder because it will grow.

**Libraries introduced:** None new. Zod used for boundary validation
for the first time, having previously only validated environment
variables.

**Functions written:** No named functions. Three refine predicates:
the bcrypt byte limit, students-must-have-a-rollNo, and
non-students-must-not.

**Concepts learned:** mass assignment · privilege escalation ·
strict object validation · input vs output type · schema
composition · implication in a predicate · boundary validation

**.strict() is the most important line in the file.** By default Zod
*ignores* unknown keys, so { email, password, name, rollNo, role:
"admin" } would parse successfully and silently drop role. That
sounds safe and is fragile: the moment a controller does
`UserModel.create({ ...req.body, role: "student" })`, someone
reorders the spread or adds a field and the dropped key comes back.
.strict() makes the attempt fail loudly with "Unrecognized key:
role" instead of silently succeeding. Defence in depth — the field
is not in the schema, *and* sending it is an error. Honest cost: a
client sending an extra harmless field gets a 400, so a frontend
adding rememberMe before the backend knows about it breaks. The
right trade for an endpoint granting access to academic-integrity
records.

**Decision made — two schemas rather than one with a conditional.**
The rejected alternative was a single schema with
role: z.enum(ROLES).optional() and the controller checking whether
the caller is an admin. That works and puts the security decision
inside a conditional where it can be missed while refactoring. Two
schemas make it *structural*: RegisterInput has no role property at
all, so a controller cannot accidentally pass one — it is a compile
error, not a runtime check.

**The second cross-field rule is the File 020 sparse-index trap
surfacing at the HTTP boundary.** A sparse unique index skips
*missing* fields, so a faculty account with rollNo undefined is
fine — but sending rollNo: "" or null would put the document into
the index, and the second such faculty account would collide with
E11000. Rejecting it here means the model never sees it. Confirmed
in testing: "faculty WITH rollNo" fails.

**Decision made — loginSchema is deliberately loose**, with no
.email() and no length rules. Three reasons. Strict validation is an
information leak: if a well-formed-but-unregistered email returns
401 while a malformed one returns 400, an attacker learns which
addresses are *shaped* like real accounts — the same enumeration
surface File 030 and File 033 both worked to close. Rules change
over time: raising the password minimum to 12 would lock out every
existing user with an 11-character password, rejected at the
boundary before verifyPassword is reached. And the check that
matters is the hash comparison, which length rules add nothing to.
**Viva phrasing: registration enforces policy; login only checks
credentials.**

**Decision made:** password rules duplicated from File 033's
password.ts, deliberately. Different purposes — the Zod layer gives
a *useful* 400 naming the field so the frontend can highlight it,
while password.ts is the backstop for code paths that do not come
through HTTP, like the seed script. The byte-length check is
non-negotiable in both: bcrypt silently truncates past 72 bytes, and
Buffer.byteLength rather than .length matters because a Devanagari
character is three bytes. Confirmed: 57 Devanagari bytes accepted,
100 emoji bytes rejected.

**Normalisation happens here *and* in the Mongoose setters**, which
is intentional redundancy rather than duplication. Zod catches HTTP
input; Mongoose catches the seed, migrations and admin tools.

**z.infer cashes in the File 007 argument.** Zod was chosen over Joi
on exactly this — one schema gives runtime validation *and* the
compile-time type. RegisterInput is derived from the schema so it is
always accurate, and it reflects the *output* type after transforms.
File 038's controller signature makes req.body.role a compile error,
because the property does not exist.

**Uncertainty to resolve before the demo:** the rollNo regex
/^[A-Z]{2,4}\\d{4,10}$/ is a generalisation of BCS2023126. If
Invertis uses a different scheme — a slash, a hyphen, a different
letter count — this will reject valid roll numbers, and that is the
kind of thing that only surfaces in front of an examiner. Check it
against a real list; /^[A-Z0-9-]{6,20}$/ is the safe fallback.

**Used z.string().email() rather than Zod 4's newer top-level
z.email().** Both should work; the chained form is *demonstrated*
working in our exact version, since File 031's test produced
"Invalid email address" from it. Preferred the form seen running
over the one believed current.

**Deliberately not here:** password confirmation (a frontend
concern), CAPTCHA and rate limiting (Phase 3, with the Redis store),
and email-verification tokens (needs email delivery, out of scope —
name it in the report's limitations).

**Commit:** `feat(api): add auth validation schemas with strict object parsing`

## 2026-09-18 — Day 10 — File 037: apps/api/src/middleware/validate.ts

**What we built:** A generic factory turning any Zod schema into
Express middleware, parsing body, query or params and *replacing*
the parsed part with the result. Three convenience wrappers. Plus
pino-http wired into app.ts and errorHandler switched to read
req.id.

**Why we built it:** File 036 declared what valid input looks like;
nothing ran those schemas. Without middleware every controller opens
with the same three lines, and the one that forgets means
unvalidated input reaching the database — a worse failure than a
forgotten error handler. The second job is what makes it more than
boilerplate: replacing req.body means the controller receives
normalised, typed data rather than raw input plus a promise to be
careful.

**Why a separate file:** Separate from the schemas because a schema
is data and this is behaviour — one generic function serves all
twenty schemas, and they do not need to know Express exists.
Separate from errorHandler despite both being middleware: that one
is the funnel at the *end*, this runs *before* a controller. The
split is what lets this file simply throw, since File 031 already
knows how to turn a ZodError into a 400 with a field list.

**Libraries introduced:** None new. pino-http, installed at File 032
and unused until now, is finally wired.

**Functions written:**
* validate(schema, source) — returns middleware. Same higher-order
  pattern as requireRole at File 035, and for the same reason: the
  schema differs per route.
* The returned validator — safeParse, then next(error) or replace
  and continue. Never throws directly.
* validateBody / validateQuery / validateParams — pre-configured
  wrappers. Arguably unnecessary, kept because routes are read far
  more than written and validateQuery(schema) says what it does
  without checking a second argument.

**Concepts learned:** getter-only property · Object.assign · request
ID / correlation ID · ZodType · type gymnastics

**Replacing req.body is the line that matters.** Without it the
middleware only *checks* and hands the controller the original
object, so req.body.email would still be "  Sam@X.COM  " and every
transform from File 036 would be discarded. Replacement also means
unknown keys are gone even without .strict(), so { ...req.body } in
a controller is safe — a second layer under .strict() where either
alone is sufficient. Confirmed in testing: the controller received
"sam@invertis.ac.in" and "BCS2023126".

**Express 5 change worth knowing: req.query and req.params are
getter-only.** Assigning throws "Cannot set property query of
#<IncomingMessage> which has only a getter". Object.assign mutates
in place instead. **Honest consequence:** for query and params,
unknown keys are *not* removed — Object.assign copies the parsed
fields over and leaves anything else. So .strict() is the real guard
on query parameters, and the belt-and-braces stripping only applies
to body. Worth knowing rather than assuming symmetry.

**Why query validation matters:** every query value arrives as a
*string*, so ?limit=50 gives "50". A schema with z.coerce.number()
converts it — the same coercion problem as env.ts at File 009, at a
different boundary. Confirmed: typeof req.query.page was "number"
after validation.

**Decision made — ZodType rather than a generic ZodSchema<T>.** The
generic version would let TypeScript infer the parsed shape and flow
it into req.body's type. It also means fighting Express's Request
generics, which are four type parameters deep and produce error
messages nobody can read. **Honest trade:** req.body stays typed as
any after validation, and controllers cast with
`req.body as RegisterInput`. The cast is *sound*, because this
middleware guarantees the shape — but it is less elegant than
inference, and that is simplicity chosen over type gymnastics rather
than a free win.

**Decision made:** next(error) rather than throw. Both work in
Express 5, but next(err) is explicit about routing to error
middleware and also works in Express 4, which matters if a teammate
copies the pattern from a tutorial-based project. And safeParse
rather than parse, so success and failure are both visible in the
code rather than one being implicit in a thrown exception — the same
reasoning as env.ts.

**Decision made:** no error translation here. File 031 already
handles ZodError. Two places knowing Zod's error shape is one too
many.

**File 031 and File 010 revisit — the request-ID gap closed.**
File 031 generated a correlation ID at *error* time, so only
failures were traceable and a student reporting "the page was slow"
had no ID to give. pino-http now attaches one to every request,
returns it as an x-request-id response header, and errorHandler
reads req.id rather than generating its own. Previously an error
body and its log line carried *different* UUIDs for the same
request, which would have been actively confusing during a real
investigation. Confirmed in testing: the header and the error body
carry the same id.

**customLogLevel drops /health to debug.** Without it every request
logs at info, and the Docker healthcheck hits /health every ten
seconds — 8,640 lines a day of pure noise burying everything else.
At debug it is filtered out by default but still available.
pino-http is registered *first*, before helmet, so a request failing
inside any later middleware is still logged with its timing and
status.

**Deliberately not here:** header validation (headers are set by
clients and proxies we do not control, and rejecting unexpected ones
breaks in ways that are hard to diagnose — the one header that
matters, Authorization, is parsed by extractBearerToken), file
validation (multipart is not JSON; multer handles it in Phase 3),
response validation (overkill — we control what we send), and input
sanitisation (XSS is the frontend's concern since React escapes by
default, and sanitising on input would corrupt legitimate code
submissions, which contain < and > constantly).

**Commit:** `feat(api): add validation middleware and per-request logging`

**Battle — pinoHttp default import not callable.** TS2349: "Type
'typeof import(...pino-http/index)' has no call signatures." Cause:
pino-http v11 is CommonJS but its .d.ts uses `export default`, and
our tsconfig has module: NodeNext without esModuleInterop — so a
default import from a CJS module resolves to the module *namespace*
rather than the function. express and pino work because their
definitions use `export = express`, the TypeScript form for "this
module's whole export is one value", which NodeNext handles.

**Fix:** `import { pinoHttp } from "pino-http"`. The package exports
it by name at both the type level (`export { PinoHttp as pinoHttp }`)
and at runtime (`module.exports.pinoHttp = pinoLogger`).

**Lesson:** when a default import of a CommonJS package fails under
NodeNext, look for a named export of the same thing. It usually
exists.

**Battle — query coercion silently discarded.** Validation ran and
rejected limit=500 correctly, but req.query.page was still the
string "3" and schema defaults were not applied.

**Cause:** in Express 5, req.query is a *getter that re-parses the
URL on every access*. Object.assign mutates a throwaway object, and
the next read returns strings again. Verified against Express 5
directly: Object.assign gave {"page":"9"} (string) while
Object.defineProperty gave {"page":3} (number).

**Fix:** Object.defineProperty(req, source, { value, writable,
configurable }) replaces the property outright.

**This also corrects an earlier claim in this entry.** I wrote that
unknown keys survive on query because Object.assign copies over
them. With defineProperty the whole object is replaced, so query and
params behave exactly like body — unknown keys are gone.

**Lesson:** "it validated correctly" is not the same as "the parsed
result was used." The rejection tests all passed while the success
path silently threw its output away.

## 2026-09-18 — Day 10 — File 038: apps/api/src/controllers/authController.ts

**What we built:** Six handlers — register, createUser, login,
refresh, logout, me — composing everything from Files 030–037 into
operations a user can perform. Plus db/redis.ts, an ioredis client
with a jti deny-list, wired into server.ts startup and shutdown.

**Why we built it:** This is the first file that *does something*
rather than defining a capability. Files 033–037 are primitives —
hash a password, sign a token, verify a role, parse a body — and
none of them is an operation a user can perform.

**Why a separate file:** Separate from the routes because a route
says which URL maps to which handler while a controller says what
the handler does. That split makes a controller testable by direct
call and keeps the route file a readable table of endpoints.
Separate from the utils because those are pure functions with no
HTTP; this is the composition layer.

**Libraries introduced:** ioredis — chosen over node-redis (the
official client, and fine) because ioredis has better cluster
support and is what BullMQ uses internally, so Phase 3's queue pulls
it in anyway. One client rather than two. Redis over MongoDB for
revocation because TTL expiry is native and a deny-list is pure
key-value with no query needs.

**File 020's deferred decision came due.** I rejected a pre("save")
hashing hook there with a stated trade-off: the hook is safer
against forgetting, and we accept a small risk for an explicit cost.
This controller is the one place that must not forget. There are
exactly two write paths — here and the seed — and both hash
explicitly.

**File 030's deferred timing leak, closed.** I wrote there that the
identical "Authentication required" message stops an attacker
*reading* which emails exist, but a subtler leak remained: a naive
login returns in ~5ms for an unknown email and ~255ms for a wrong
password, because only the second runs bcrypt. That 250ms gap is
trivially measurable over a network, so scripting a few thousand
addresses would yield a clean list of registered accounts and the
identical message would have bought nothing. fakeVerify() on the
not-found path closes it. **Ordering detail:** the isActive check
comes *after* password verification — reversed, a deactivated
account would return faster than a wrong password and reintroduce
the signal.

**File 034's deferred rotation, implemented.** refresh revokes the
presented token's jti and issues a new pair, so a stolen refresh
token is usable exactly once and its reuse is *detectable* — the
legitimate user's next refresh presents an already-revoked token and
fails. **Honest gap:** best practice treats a revoked-token
presentation as evidence of compromise and invalidates the entire
token family, logging the user out everywhere. We log a warning and
reject. Better than nothing, short of best practice — name it in the
report.

**The role is re-read from the database on refresh**, so a demotion
takes effect within 15 minutes rather than 7 days. That bounds the
stale-role window flagged at File 034 to the access token's life.

**Decision made — header tokens rather than httpOnly cookies, and
this is the weakest security decision in Phase 2.** An httpOnly
cookie is meaningfully safer against XSS, since JavaScript cannot
read it and an injected script cannot steal the token, while a
header token usually lives in localStorage where any script can read
it. But cookies are a *browser* mechanism: the Android app would
need a cookie jar and withCredentials, and cookies bring CSRF into
scope needing its own mitigation. One token format for two clients
is the constraint the spec sets. Mitigated by a 15-minute access
token and rotation, which bound the damage rather than preventing
it. A production system serving only a browser should use httpOnly
cookies. **Report limitation.**

**Decision made:** explicit fields rather than ...req.body in
register. .strict() already rejects a role key and File 037 replaces
req.body with parsed output containing only schema fields — this is
the *third* independent layer, and the one that holds even if a
future schema drops .strict(). role: "student" is a literal in the
source, so there is no code path by which a client can influence it.

**.select("+passwordHash") appears exactly once in the codebase.**
That was the whole argument for select: false at File 020 — the
dangerous case is the forgotten one, and res.json(await
UserModel.find()) in some list endpoint would otherwise serialise
every hash. And res.json({ user, ...tokens }) is safe even with the
hash loaded, because the serialize plugin from File 027 strips it at
the JSON boundary. Two independent mechanisms, and the second is
what saves us here.

**Decision made:** audit entry written *second*, after the state
change. This is the File 019 transaction limitation designed around:
we cannot do both atomically on a standalone node, so a crash
between them leaves either a real account with no log entry (bad) or
a log entry for an account that never existed (worse, because it is
a *false record*). An audit trail containing entries for things that
never happened is untrustworthy in a way a missing entry is not.
Note the seed script gets this backwards, as flagged at File 029 —
this file is the correct pattern.

**Decision made:** a deny-list rather than an allow-list. Storing
every issued token would mean a Redis write per login and a set
growing with usage. tokensFor discards the jti at issue time and it
is read back out of the token when presented, so Redis holds only
revocations and the TTL cleans them up.

**Decision made:** logout returns 204 even on a garbage token. A
client that has lost or corrupted its token still needs to clear
local state, and returning 401 would leave the frontend unable to
log out — a worse experience than an ineffective revocation, which
achieves nothing anyway on a token that was never valid.

**Known smell:** REFRESH_TTL_SECONDS is hardcoded as 7*24*60*60,
duplicating JWT_REFRESH_EXPIRY=7d in .env. Change one and the other
silently disagrees. Not derived because the env value is a string
like "7d" and parsing durations properly means a dependency or a
hand-written parser. **The better fix is to read the token's own exp
claim** and compute the remaining seconds, which is more correct
anyway since a token presented on day six needs only one more day of
revocation. Two lines once verifyRefreshToken returns exp.

**No try/catch anywhere in this file.** Express 5 forwards a
rejected promise from an async handler to the error middleware
automatically — the File 007 version note doing real work.

**Commit:** `feat(api): add auth controller with token rotation and revocation`

## 2026-09-21 — Day 11 — File 039: apps/api/src/routes/authRoutes.ts

**What we built:** An Express Router with six auth endpoints —
register, login, refresh, logout (public), me (signed in) and users
(admin only) — mounted at /api/auth in app.ts before the not-found
handler.

**Why we built it:** Files 035–038 built middleware and handlers,
and no URL reached any of them. After this file the running API
accepts real logins for the first time.

**Why a separate file:** The controller says what a handler does;
the route file says which URL reaches it and what runs first.
Reading this file should show every auth endpoint and its protection
at a glance. Separate from app.ts, which assembles routers rather
than defining them.

**Libraries introduced:** None new. First use of express.Router —
a mountable group whose paths are relative, so the prefix is decided
where it is mounted.

**Functions written:** None. Six route registrations.

**Concepts learned:** router · mount point · middleware chain order ·
safe method · API versioning

**Decision made — authorise before validating on protected routes.**
On /users the chain is requireAuth, requireActiveUser, requireRole,
validate, createUser. Reversed, a stranger posting {} would get a
400 with a field list — email, password, name, role, rollNo — which
tells them the endpoint exists, what it creates, and that role is
settable somewhere. Authorising first gives them a 401 and nothing
else. Don't describe a door to someone not allowed to open it.
Confirmed: an empty unauthenticated POST to /users returned 401,
not 400.

**requireActiveUser only on /users.** Creating an account with an
arbitrary role is the most privileged operation in the system, and a
deactivated admin's token works for up to 15 minutes otherwise. It
sits before requireRole, honouring the ordering dependency flagged
at File 035.

**Decision made:** POST for refresh and logout. Both write to the
Redis deny-list, and GET is meant to be safe to repeat — a
GET /logout could be triggered by an <img> tag on any page.

**Decision made:** no version prefix. /api/v1 exists so old clients
keep working while the API changes; we have one client version of
each app and control all of them. The router is prefix-agnostic, so
adding one later is a one-line change in app.ts.

**Ordering in app.ts:** the router mounts after /health and before
notFoundHandler. After it, every auth request would 404, since
Express runs handlers in registration order and the not-found
handler matches everything.

**Open gap:** no rate limiting on /login, the most obvious
brute-force target. bcrypt's 250ms per attempt is a partial defence,
not a real one. Phase 3, using the Redis connection from File 038.

**Also verified by this file's test:** File 038's refresh rotation
(a replayed refresh token returned 401 TOKEN_INVALID) and File 037's
pino-http wiring (x-request-id present on a successful request) —
both committed untested last week because of a stale MONGO_URI.

**Commit:** `feat(api): add auth routes and mount them on the app`

## 2026-09-21 — Day 11 — File 039 (verified): the auth flow over HTTP

**What we did:** Ran File 039's test for the first time against a
live server. It had been committed with a failing test, because Mongo
refused the connection.

**Problem faced — duplicate keys in infra/.env.** MONGO_URI,
REDIS_HOST, MINIO_ENDPOINT and DETECTOR_URL each appeared twice. At
File 019 the localhost values were appended instead of replacing the
container values. When a key repeats, the last value wins, and the
effective MONGO_URI held an old password: "Authentication failed"
(code 18).

**Why the check misbehaved:** a PowerShell check meant to print
True/False printed a whole line. `-match` on one string returns a
boolean; on an array it filters and returns the matching items. Two
matching lines meant an array.

**Second trap:** the Mongo image applies MONGO_INITDB_ROOT_PASSWORD
only when its data volume is first created. Changing .env afterwards
changes nothing until `docker compose down -v`.

**How we solved it:** removed the container-hostname lines, rotated
the Mongo password (hex, so nothing needs URL-encoding in the URI;
the old one had been printed into a shared file), ran `down -v` and
`up -d`, recreated the submissions bucket, re-seeded.

**Problem faced — a type imported as a value.** The rebuilt test
imported `User` from the model barrel. verbatimModuleSyntax rejected
it: `User` is the document *type*; the model is `UserModel`.

**Result:** 15/15 PASS. Register (201, no hash, 409, role injection),
login (identical failures, about 220 ms either way thanks to
fakeVerify), /me, the token-type check, refresh rotation, logout,
403 for students, stale-role correction, request ids. This also
verified Files 034–038 and File 037's x-request-id.

**Correction to the File 039 entry:** it says an empty
unauthenticated POST to /users was confirmed to return 401. Neither
the rebuilt test nor File 040 checks that case. It follows from the
middleware order but is unverified; add it to the tests.

**Known issues carried forward:** the /refresh failure message says
"Access token is invalid"; /register's 409 reveals that an email
exists (rate limiting is the real defence); pino-http logs every
response header.

**Lessons:** check any output file for PASSWORD, SECRET and
mongodb:// before sharing it. A diagnostic command should print
counts or booleans, never values.

**Commit:** `docs: record .env duplicate fix and verified auth flow`

## 2026-09-21 — Day 11 — File 040: apps/api/tests/auth.test.ts

**What we built:** The auth flow as 15 automated tests (`npm test`)
instead of throwaway scratch files.

**Why we built it:** A scratch file proves the code worked once.
A test file re-proves it after every later change, with one command
and a pass/fail answer.

**Why a separate file:** tests/ sits outside src/, so tsc never
compiles it into dist/ and it never reaches the Docker image. One
test file per feature, so a failure names the area that broke.

**Libraries introduced:** supertest (dev only), which calls the
Express app in-process without opening a port, plus @types/supertest.

**Functions written:** pick(body, key), which finds a key at the top
level or one level down, so the tests do not depend on the exact
response shape.

**Concepts learned:** integration test · test isolation · hoisting
of imports · in-process testing

**Decision made — real Docker services on a separate database.**
Tests use the Docker Mongo and Redis but the `codeguard_test`
database, not mongodb-memory-server (a ~100 MB binary on first run,
plus a fake Redis). Cost: `npm test` needs Docker running.

**Key trick:** static imports run before any line of the file. So
app, db and models are imported dynamically in beforeAll, after
MONGO_URI has been rewritten; otherwise env.ts would read the old URI.

**Decision made — shared state between tests.** Login stores the
tokens and later tests use them. Much less code and fewer bcrypt
hashes, but one early failure cascades, so read the first failure.

**Trade-offs:** tsc does not type-check tests/; the audit-log write
in createUser is not tested yet.

**Commit:** `test(api): add auth flow integration tests and verify query coercion`

## 2026-09-21 — Day 11 — File 040 (fix): a lying log and a guard on the wrong thing

**Problem faced:** during `npm test` the "mongo connected" log said
db "codeguard", which suggested the tests had wiped the dev database.

**How we checked:** listed every database with its user count.
codeguard had 33 users (untouched) and codeguard_test had 0 (used,
then cleared). The tests were fine; the log was wrong.

**Cause:** connect.ts logged `env.MONGO_DB`, a separate variable,
while the database actually comes from the URI. Two sources of truth
that nothing keeps in sync.

**How we solved it:** connect.ts now logs `mongoose.connection.name`.
The test guard now checks `mongoose.connection.name ===
"codeguard_test"` after connecting and before clearing. The old check
only verified the URI string, the input rather than the outcome.
vitest still runs afterAll when beforeAll throws, so afterAll checks
too. Verified: the guard refused to run when forced, and skipped all
15 tests without hanging.

**Lesson:** logs and safety checks must report or verify real state,
not the configuration expected to produce it.

**Open:** find out whether MONGO_DB is used anywhere else; if not,
remove it from env.ts.

**Commit:** `fix(api): log the real database name and guard tests on the connected db`

## 2026-09-21 — Day 11 — Phase 2 closed (Files 030–040)

Error envelope, logging with redaction and request ids, bcrypt
passwords, JWT with a type claim and rotation, the Redis deny-list,
auth/role/active-user middleware, strict Zod validation, auth routes,
and 15 automated tests.

Carried into Phase 3: the /refresh message; no rate limiting; pino-http
logs every response header; the unverified /users 401 case.

## 2026-09-21 — Day 11 — File 041: apps/api/src/validation/common.ts

**What we built:** Shared Zod helpers for every Phase 3 schema:
objectId, pagination (page and limit), queryBoolean and skipFor.

**Why we built it:** Course, assignment and submission routes all
receive ids in the URL, page/limit in lists and yes/no filters, and
each of those has a trap.

**Why a separate file:** They belong to no single resource. Inside
courseSchemas.ts, assignmentSchemas.ts would have to import from the
course file just to validate an id.

**Libraries introduced:** None new.

**Functions written:** skipFor(page, limit) = (page - 1) * limit,
which avoids the off-by-one `page * limit` that skips page 1.

**Concepts learned:** ObjectId · NoSQL injection · truthy values ·
coercion · offset pagination

**Problem faced:** z.coerce.boolean("false") is true, because it
calls Boolean() and every non-empty string is truthy. So
?archived=false would have shown only archived courses.

**How we solved it:** queryBoolean accepts only "true" or "false" and
transforms them. env.ts already uses the same trick for MINIO_USE_SSL.

**Decision made:** objectId requires a string of exactly 24 hex
characters. It fails before the database with a field name, and it
blocks NoSQL injection like {"$ne": null}, because an object is not a
string. Offset pagination over cursor pagination: simpler, and enough
for hundreds of records. Limit capped at 100.

**Plan change:** MinIO storage moved to File 047, just before upload.

**Commit:** `feat(api): add shared validation helpers for ids, pagination and query booleans`

## 2026-09-21 — Day 11 — File 042: apps/api/src/validation/courseSchemas.ts

**What we built:** What a client may send for courses: create,
update, enrol/remove students, list, and the courseId param. Every
body is .strict().

**Why we built it:** The course controller (File 043) should receive
data that is already clean and typed.

**Why a separate file:** One schema file per resource, the same
pattern as authSchemas.ts.

**Libraries introduced:** None new. First use of Zod 4's
.toUpperCase() and of .transform on an array.

**Functions written:** None. Five schemas and four inferred types.

**Concepts learned:** refinement · immutable by omission · Set ·
separating shape from permission

**File 036 revisit:** `rollNo` in authSchemas.ts is now exported, so
enrolment reuses the same rule. One source of truth.

**Decision made:** code is trimmed, uppercased, then checked; Zod 4
runs these in order. The pattern is permissive on purpose (CS-501,
BCSE-301A). academicYear: regex for the shape, refine for the meaning
(second year = (first + 1) % 100, which handles 2099-00).

**Decision made:** the update schema has no code or academicYear, so
they are immutable by omission. isArchived uses z.boolean(), because
JSON bodies carry real booleans; only query strings need
queryBoolean. An empty update is rejected.

**Decision made:** enrolment by roll number, since faculty do not
know Mongo ids. One schema for enrol and remove. Duplicates are
removed after normalisation (BCS2023126 and bcs2023126 became one).
At most 200 per request.

**Decision made:** `faculty` is optional in create, because who may
send it depends on role. The schema checks shape; the controller
checks permission.

**Zod 4 quirk:** unknown keys are non-fatal, so the "Nothing to
update" refine also fires on {code: ...}, giving two errors for one
mistake. Harmless; the fix, if needed, is refine's `when` option.

**Commit:** `feat(api): add course validation schemas and export the roll number rule`

## 2026-09-22 — Day 12 — PROJECT_NOTES (fix): duplicates and format drift

Removed two entries that had been pasted twice (File 028 fix, File
039). Rewrote the Day 11 entries from File 039 (verified) onward in
the house format; they had been written as bullet lists. Added the
missing .env battle and a correction to File 039's unverified claim.
No other entry was changed.

**Commit:** `docs: remove duplicate entries and restore the notes format`

## 2026-09-22 — Day 12 — File 043: apps/api/src/controllers/courseController.ts

**What we built:** Six course handlers (create, list, get, update,
enrol, remove) and the project's first ownership rule.

**Why we built it:** Until now permission meant "which role are you".
Courses add "is this yours": a faculty member may manage courses, but
only their own.

**Why a separate file:** Routes map URLs, schemas clean input, the
controller decides. Handlers are plain (req, res) functions, so this
file was tested by calling them directly, before any route existed.

**Libraries introduced:** None new. First use of $addToSet with
$each, $pull with $in, ObjectId.equals, countDocuments and
sort/skip/limit.

**Functions written:** courseView (shapes a response; the roster is
for owner and admin only, studentCount for everyone), loadCourseFor
(the ownership rule, written once), and the six handlers.

**Concepts learned:** object-level authorisation (BOLA, OWASP API #1)
· enumeration · lost update · atomic operation · defence in depth ·
nullish coalescing

**Decision made — 404, never 403, for a course you can't touch.**
Otherwise the response confirms the id exists. A faculty member
creating a course for someone else still gets 403, because nothing
secret is revealed.

**Decision made — partial enrolment.** Valid roll numbers are
enrolled, and the rest are reported as notFound. Only active students
count. Repeating the request is harmless, so fixing typos means
resending only the corrected entries.

**Decision made — atomic operators, not read-modify-save.**
$addToSet/$pull do the read and write in one step, so two
simultaneous enrolments can't overwrite each other. save() in
updateCourse is safe for the same reason: it writes only the modified
fields.

**Decision made:** archived courses are read-only for enrolment
(409); lists hide them unless archived=true. Removing a student keeps
their submissions: evidence is never deleted as a side effect.
Removal ignores role and isActive, so deactivated students can still
be removed.

**Trap avoided:** ObjectId === string is always false. .equals()
compares values; getting this wrong would silently 404 everyone.

**Limitations:** the alreadyEnrolled/removed counts can be slightly
off under truly simultaneous requests (the data can't be). No audit
entries for enrolment yet; AUDIT_ACTIONS is a fixed list, to be
planned with the review flow.

**Open for File 044:** removal will likely be POST
/courses/:courseId/students/remove, because some clients drop DELETE
bodies.

**Verified:** called the handlers directly with a fake req/res on
codeguard_test, with no routes yet. All 25 expected results matched,
including an identical 404 for "not yours", "not enrolled" and
"doesn't exist".

**Commit:** `feat(api): add course controller with ownership checks and atomic enrolment`

## 2026-09-22 — Day 12 — File 044: apps/api/src/routes/courseRoutes.ts

**What we built:** Six course endpoints on an Express Router, mounted
at /api/courses in app.ts: list and get (any signed-in user), and
create, update, enrol and remove (faculty and admin).

**Why we built it:** File 043's handlers worked but no URL reached
them. After this file the course feature is usable over HTTP by the
web and Android clients.

**Why a separate file:** A route file is a readable table of
endpoints and their protection. The controller decides what happens;
the routes decide who can reach it and in what order.

**Libraries introduced:** None new. First use of router-level
router.use() and of spreading a middleware array into a route.

**Functions written:** None. Six route registrations, one
router-level middleware, and the `staff` array.

**Concepts learned:** router-level middleware · middleware chain ·
action endpoint · idempotent

**Decision made — requireAuth once, for the whole router.**
router.use(requireAuth) guards every path under /api/courses, so no
route can forget it. Unauthenticated requests to unknown course paths
get 401, not 404.

**Decision made — requireActiveUser on writes only.** It costs a
database read per request. A deactivated faculty member reading for
up to 15 more minutes is tolerable; changing rosters is not. It runs
before requireRole because it corrects a stale role.

**Decision made — roles on routes, ownership in the controller.**
The route can check the role from the token; only the controller,
after loading the course, can check "is it yours".

**Decision made — POST /:courseId/students/remove, not DELETE with a
body.** A DELETE body has no defined meaning in HTTP and some proxies
and clients drop it. Less pure REST, reliable everywhere.

**Order kept from File 039:** authorise, then validate params, then
validate the body. A student posting {} gets 403, not a field list.

**Commit:** `feat(api): add course routes and mount them at /api/courses`

## 2026-09-22 — Day 12 — File 045: apps/api/src/validation/assignmentSchemas.ts

**What we built:** Schemas for creating, updating and listing
assignments, and the assignmentId param.

**Why we built it:** Assignments bring two risks courses didn't:
time (deadlines have timezones) and baseline integrity (provenance
decides what may ever enter a student's Layer 2 baseline).

**Why a separate file:** One schema file per resource. LANGUAGES and
PROVENANCE are imported from the model, so the database rule and the
API rule cannot drift apart.

**Libraries introduced:** None new. First use of Zod 4's
z.iso.datetime({ offset: true }) and enum .exclude().

**Functions written:** None. Four schemas, three inferred types.

**Concepts learned:** ISO 8601 · UTC offset · local-time parsing ·
provenance · state-dependent rule

**Problem avoided — timezone-less deadlines.** JavaScript parses a
date-time without an offset in the parsing machine's timezone: IST on
the laptop, UTC in Docker. "23:59" would mean two different moments.
The schema requires Z or an offset and rejects anything else.
Verified: 23:59:00+05:30 is stored as 18:29:00Z, the same moment.

**Decision made:** Date.now() is called inside each refine, so "the
future" is measured per request. A module-level `now` would freeze at
server start. Deadlines must also be within a year, which catches
2062-for-2026 typos.

**Decision made — provenance.** "unknown" is excluded from what
faculty may choose (it exists for imported data only), and the model
default is "takehome": if nobody decides, the work is treated as
untrusted.

**Decision made:** course comes from the URL, not the body, so the
File 043 ownership check applies and there is no second source for
the same fact.

**Deferred to File 046:** language and provenance are accepted by the
update schema, but the controller must refuse to change them once any
submission exists. Otherwise homework could be retroactively made
baseline-eligible, or parsed with the wrong grammar.

**Decision made:** deadlines can be extended but not moved into the
past; closing early would be a separate, explicit feature.

**Commit:** `feat(api): add assignment validation schemas with timezone-safe deadlines`

## 2026-09-22 — Day 12 — File 046: apps/api/src/services/access.ts

**What we built:** A shared access service: canAccessCourse (the rule
as a pure function), loadCourseFor and loadAssignmentFor. Also a
File 043 revisit: courseController.ts now imports loadCourseFor
instead of defining it. No handler changed.

**Why we built it:** Assignments need the same ownership rule as
courses, since access to an assignment follows its course. A security
rule copied into two controllers will eventually be wrong in one of
them. Moved before the assignment controller exists, so there was
never a second copy.

**Why a separate file:** A controller importing from another
controller is a tangle. Logic shared by several controllers, and not
shaped like HTTP, belongs one level below them: the service layer.

**Libraries introduced:** None.

**Functions written:** canAccessCourse(user, course, access): admin
always; owner for view and manage; enrolled students view only.
loadCourseFor(req, access) and loadAssignmentFor(req, access): read
the id from a fixed URL param, load, check, and return the same 404
for missing and not-allowed.

**Concepts learned:** service layer · pure function · refactor ·
NonNullable<T>

**Decision made — students never see unpublished work.** A draft
returns 404 to a student even in a course they are enrolled in, the
same answer as for an assignment that doesn't exist. Verified: s1 got
404 on the draft, and OK once only isPublished changed.

**Decision made:** loadAssignmentFor returns the course along with
the assignment, so the controller can check isArchived without a
second query. Two lookups by id rather than populate, for simpler
types; both are fast at this scale.

**Verified as a refactor:** loadCourseFor behaves exactly as in File
043 (owner, enrolled, other faculty, admin), getCourse still hides
the roster from students, and npm test still passes 15/15.

**Plan renumbered:** 047 assignment controller, 048 assignment
routes, 049 MinIO storage, 050 upload middleware, 051–052 submission
controller and routes, 053 rate limiting, 054–055 course and
submission tests.

**Commit:** `refactor(api): move course and assignment access checks into a shared service`

## 2026-09-22 — Day 12 — File 047: apps/api/src/controllers/assignmentController.ts

**What we built:** Four assignment handlers: create and list within a
course, get and update a single assignment.

**Why we built it:** Faculty create, publish and extend assignments;
students see published ones and how many attempts they have used.

**Why a separate file:** One controller per resource. All access
checks come from services/access.ts (File 046), so this file has no
ownership logic of its own.

**Libraries introduced:** None. First use of Model.exists() and
doc.set(object).

**Functions written:** createAssignment, listAssignments,
getAssignment, updateAssignment.

**Concepts learned:** TOCTOU · exists vs countDocuments · frozen field

**Decision made — lock three things after the first submission.**
language (old submissions would be parsed with the wrong grammar),
provenance (homework could become baseline-eligible after the fact)
and unpublishing (students would lose sight of their work). Only a
real change is refused: resending the current value is allowed, so a
form that submits every field doesn't trigger a false 409.

**Decision made — students can't opt out of the published filter.**
The student branch never reads ?published, so ?published=false still
returns only published work.

**Decision made:** the course comes from the URL and is spread after
the body, so it wins even if .strict() were ever removed. Omitted
fields stay absent, so model defaults apply (takehome, 3 attempts,
unpublished).

**Decision made:** students get yourAttempts (their own count only),
so clients can show "1 of 3 used" without a second request.

**Limitation — TOCTOU.** A submission could land between exists()
and save(). The window is milliseconds and needs a provenance change
at the moment of a first submission. Closing it needs a transaction,
which our standalone MongoDB can't run (File 026).

**Known nit:** the update log records the fields sent, not the fields
changed ("language" was logged on a no-change resend). Fix: log
assignment.modifiedPaths() after set(), before save().

**Commit:** `feat(api): add assignment controller with post-submission field locks`

## 2026-09-22 — Day 12 — File 048: apps/api/src/routes/assignmentRoutes.ts

**What we built:** Two routers in one file. courseAssignmentRouter
(list and create at /api/courses/:courseId/assignments, mounted inside
courseRouter) and assignmentRouter (get and update at
/api/assignments/:assignmentId, mounted in app.ts). File 044 revisit:
courseRoutes.ts gains one mount line.

**Why we built it:** File 047's handlers had no URLs. Collections sit
under their parent course; a single assignment has a globally unique
id and its own address, so clients never send a redundant course id.

**Why a separate file:** Every assignment URL and its protection is
visible in one place, even though the routers are mounted in two.

**Libraries introduced:** None. First use of Router({ mergeParams:
true }) and of a router nested inside another router.

**Functions written:** None. Two routers, four routes, two mounts.

**Concepts learned:** nested router · mergeParams · prefix vs exact
match · resource-oriented URLs

**Decision made — mergeParams.** A child router can't see its parent's
:courseId by default. Without mergeParams, validateParams would reject
every nested request with 400. Verified: faculty create returned 201.

**Decision made — the nested router has no requireAuth of its own.**
It is reachable only through courseRouter, which already verified the
token; a second check would verify every JWT twice. assignmentRouter
is mounted directly in app.ts, so it has its own.

**Known duplication:** the `staff` middleware array is defined in both
route files. Two lines; unify when middleware/auth.ts is next opened.

**Commit:** `feat(api): add assignment routes, nested under courses and at /api/assignments`

## 2026-09-22 — Day 12 — File 049: apps/api/src/storage/minio.ts

**What we built:** The API's only door to MinIO: ensureBucket (run at
startup from server.ts), submissionKey, putSubmission, getSubmission,
removeSubmission.

**Why we built it:** A submission is a Mongo record plus a file, and
files belong in object storage. The manual bucket step after every
`down -v` is retired: the API creates the bucket if it's missing.

**Why a separate file:** One module per external service, like
db/connect.ts and db/redis.ts. Controllers call putSubmission, never
the SDK, so moving to AWS S3 or disk would change only this file.

**Libraries introduced:** minio, the official SDK (types included).
Chosen over @aws-sdk/client-s3: smaller and simpler against MinIO,
and it still speaks S3.

**Functions written:** ensureBucket, submissionKey, putSubmission,
getSubmission, removeSubmission (see file).

**Concepts learned:** object storage · idempotent startup · fail fast
· compensating action · orphan · stream

**Decision made — keys from ids only:** assignmentId/studentId/uuid.
The student's filename stays in Mongo as data, so a hostile name
("../../x") can't matter. The uuid matches objectKey's unique index.

**Decision made — bytes, not strings.** Files are stored and read as
Buffers, so code comes back byte-for-byte (verified with Hindi text).

**Decision made — fail fast.** If MinIO is down at startup the server
refuses to start, instead of accepting logins and failing every
upload. Runtime failures become 503 dependencyUnavailable; a missing
object is 404.

**Decision made — compensate rather than pretend.** MinIO and Mongo
can't share a transaction. The upload flow will store, record, and
remove the file if recording fails. removeSubmission never throws;
if it can't delete, it logs an orphan.

**Limitations:** the API uses MinIO's root credentials (production
should use a bucket-scoped user). Orphans can accumulate; a cleanup
job is a later concern.

**npm audit (4 moderate, all transitive via minio):** decode-uri-
component/query-string (DoS on malformed percent-encoding) and
stream-json (DoS on deeply nested JSON). Accepted, not "fixed":
their inputs are request URLs to our own MinIO (keys built from ids
and a uuid, never user text) and responses from our own MinIO. The
offered fix downgrades minio to 7.1.3, a breaking change. Re-check
with `npm outdated minio` on each minio release.

**Commit:** `feat(api): add MinIO storage module and create the bucket at startup`

## 2026-09-22 — Day 12 — File 050: apps/api/src/middleware/upload.ts

**What we built:** uploadSourceFile, which parses one multipart file
into memory, checks it, and sets a typed req.upload (content,
originalName, extension, sizeBytes, lineCount).

**Why we built it:** This is where student code enters the system,
and it is the most hostile input the API receives. Only a small, real
UTF-8 text file with a .py or .java extension may reach the
controller.

**Why a separate file:** Multipart parsing and content checks are
HTTP concerns. The submission controller receives req.upload and
never touches multer; any later upload route can reuse it.

**Libraries introduced:** multer (multipart parsing on busboy),
@types/multer. Built-ins: path.win32, TextDecoder.

**Functions written:** uploadSourceFile (exported), checkSourceFile,
countLines, toAppError.

**Concepts learned:** multipart/form-data · magic check · MIME type ·
BOM · streaming limit

**Decision made — checks from cheapest to most expensive:** size
while streaming (413 at 256 KB, inclusive), extension (415), empty
(400), NUL byte means binary (415), strict UTF-8 via TextDecoder
fatal:true (415), at most 5,000 lines (400).

**Decision made — the MIME type is ignored.** The client sets it, so
it proves nothing; we judge the bytes.

**Decision made — reject, never repair.** No re-encoding and no
stripping: the stored file must be exactly what the student sent,
because it is evidence.

**Decision made — filenames:** win32.basename strips directories on
any OS (it understands both \ and /); defParamCharset utf8 keeps
non-English names intact. The name is stored in Mongo as data only;
storage keys never contain it (File 049).

**Decision made:** the route must run auth before this middleware,
so strangers can't make the server buffer 256 KB.

**Limitation:** garbage text with a .py extension passes here. The
detector's tree-sitter parse will fail and mark it failed, which is
the right layer for that judgment.

**Commit:** `feat(api): add upload middleware that accepts only small UTF-8 source files`

## 2026-09-22 — Day 12 — File 051: apps/api/src/controllers/submissionController.ts

**What we built:** createSubmission, listSubmissions,
getSubmissionDetails and downloadSubmission. Also
validation/submissionSchemas.ts (submissionIdParams,
listSubmissionsQuery), and a File 046 revisit: access.ts gains
loadSubmissionFor.

**Why we built it:** This is where an upload becomes evidence: a
record whose provenance and language are copied from the assignment
and never change, plus the exact bytes in storage.

**Why a separate file:** The workflow lives in the controller, input
shape in the schema, and "who may read this code" in access.ts, so
the review flow can reuse it without a second copy.

**Libraries introduced:** None. First use of createHash("sha256"),
Mongoose populate and res.attachment().

**Functions written:** loadSubmissionFor (students: own work only;
staff: courses they manage; else 404), the four handlers, and
isDuplicateKey.

**Concepts learned:** SHA-256 · race condition · unique index as a
lock · populate · Content-Disposition

**Decisions agreed (A–D):** A, every accepted upload counts as an
attempt, and faculty can raise maxSubmissions. B, identical content
is stored, never refused or announced; the hash is evidence for
faculty, not a gate. C, lateness is decided by the server's clock
when the upload finishes; submittedAt uses that same instant. D,
students download only their own files; faculty only in courses they
manage; downloads are logged.

**Decision made — store, record, compensate.** putSubmission first
(503 if storage is down, nothing half-done), then create the record.
If that fails, removeSubmission. The try covers only create(), so a
later failure can never delete a file whose record exists.

**Decision made — the index settles the race.** Two simultaneous
uploads both count the same attempts; the unique index {assignment,
student, attempt} rejects one, whose file is removed, and it gets
409 "try again". Verified: records equal files after a real
concurrent pair.

**Decision made:** students are forced to their own submissions in
lists; ?student= is read only for staff. objectKey never reaches a
client.

**Limitations:** a crash between storing and recording leaves an
orphan (File 049). SHA-256 catches byte-identical copies only; near
copies are Layer 1's job.

**Commit:** `feat(api): add submission controller with storage compensation and race handling`

## 2026-09-22 — Day 12 — File 052: apps/api/src/routes/submissionRoutes.ts

**What we built:** assignmentSubmissionRouter (submit and list at
/api/assignments/:assignmentId/submissions, nested with mergeParams)
and submissionRouter (details and file at /api/submissions/:id).
File 048 revisit: assignmentRoutes.ts gains one mount line.

**Why we built it:** File 051's handlers needed URLs, and the upload
route needed its middleware in a deliberate order.

**Why a separate file:** Same two-router pattern as File 048, so the
API has one consistent shape: nested collections under their parent,
single items at their own id.

**Libraries introduced:** None.

**Functions written:** None. Two routers, four routes, two mounts.

**Concepts learned:** body parsing on demand · separate resource for
file content

**Decision made — check before reading the body.** The upload chain is
requireAuth, requireActiveUser, requireRole("student"),
validateParams, then uploadSourceFile. Verified: 300 KB with no token
gets 401 and from faculty 403, not 413, because the body was never
read.

**Known gap:** the enrolment and published check runs in the
controller, after the upload is buffered. A signed-in student could
make the server read up to 256 KB for an assignment they can't
access. Accepted: they must be an authenticated, active student, and
rate limiting (File 053) caps attempts.

**Decision made:** metadata at /submissions/:id (JSON) and bytes at
/submissions/:id/file (download), so clients never parse one to get
the other.

**Commit:** `feat(api): add submission routes with auth before upload parsing`

## 2026-09-22 — Day 12 — File 053: apps/api/src/middleware/rateLimit.ts

**What we built:** A Redis fixed-window rate limiter, rateLimit(rule),
and five policies: loginPerEmail (10 per 15 min), loginPerIp (300 per
15 min), registerPerIp (100 per hour), refreshPerIp (60 per 15 min),
uploadPerUser (10 per 10 min). Wired into authRoutes.ts and
submissionRoutes.ts. File 030 revisit: AppError gains
tooManyRequests(retryAfterSeconds), tokenInvalid accepts an optional
message, and the duplicated captureStackTrace is removed.

**Why we built it:** Closes two recorded gaps: unlimited password
guessing on /login (File 039) and students hammering the upload path
(File 052). bcrypt slows guessing; it doesn't stop it.

**Why a separate file:** The mechanism is written once; each policy is
a small rule object, so the routes read like a policy.

**Libraries introduced:** None. First use of ioredis multi/exec.

**Functions written:** rateLimit(rule), hashed(value), the five
policies, AppError.tooManyRequests.

**Concepts learned:** rate limiting · fixed window · Redis transaction
· TTL · fail open vs fail closed · credential stuffing

**Decision made — login keyed by email, not IP.** A whole lab can share
one public IP; a per-IP login limit would lock out a class during its
first practical. The per-IP rule is only a generous backstop. Emails
are trimmed and lowercased before counting, so case changes can't
dodge the limit.

**Decision made — one transaction.** INCR, EXPIRE NX and TTL run as a
unit. "INCR then EXPIRE if 1" as two round trips could leave a key
with no expiry after a crash, locking an account forever.

**Decision made — fail open.** If Redis is down, requests are allowed
and an error is logged. Rate limits only slow attackers; the /refresh
deny-list still fails closed, because it decides token validity.

**Decision made:** keys hash emails and IPs (SHA-256, 32 hex chars),
so Redis never holds a readable list of who logged in. Limiters run
before validation, so malformed requests are counted too. 429
responses carry Retry-After, plus retryAfterSeconds in the body.

**Verified:** 3-per-5s rule gives 200 200 200 429, then resets. Eleven
bad logins with mixed-case emails give ten 401s then 429, and the 429
returns before bcrypt runs. With Redis disconnected, requests pass.

**Limitations:** anyone knowing an email can block its logins for 15
minutes (every per-account limiter has this). Fixed windows allow a
2x burst at a boundary. app.set("trust proxy", 1) is needed once
Nginx sits in front, or every request will share Nginx's IP.

**Commit:** `feat(api): add Redis rate limiting for login, register, refresh and uploads`

## 2026-09-22 — Day 12 — File 054: apps/api/tests/helpers.ts

**What we built:** One shared, guarded test setup: startTestApp,
stopTestApp, createUser, signIn, bearer, pick. File 040 revisit:
auth.test.ts uses it (the 15 tests are unchanged). package.json:
test script now runs vitest with --no-file-parallelism.

**Why we built it:** File 055 adds two test files. Copying the setup
would mean three copies of a safety guard. It also fixes the test
pollution introduced by File 053: login counters survived between
runs, so the fourth npm test within 15 minutes failed with 429.

**Why a separate file:** Test files should read as what is being
proven; the plumbing lives once. Named helpers.ts, not setup.ts,
because vitest has its own setup-files feature.

**Libraries introduced:** None.

**Functions written:** see file. startTestApp: settings, dynamic
imports, connect, guard, then clear the database, rl:* keys and test
bucket. stopTestApp does nothing after a refused start.

**Concepts learned:** test pollution · test fixture · file parallelism

**Decision made — the guard is structural.** mods is set only after
the connected database is verified, so stopTestApp can't clean
anything after a refused start. The File 040 rule is now built into
the code instead of being remembered in each file.

**Decision made — sequential test files.** Parallel files sharing one
test database would clear each other's data mid-run, giving random
failures. --no-file-parallelism costs seconds.

**Decision made:** tests use a separate MinIO bucket (submissions-test),
emptied and removed at start and end, so no test can touch the real
bucket.

**Verified:** npm test four more times in a row, all 15 passed; no rl:*
keys left afterwards; the guard still refuses without the URI rewrite.

**Limitation:** tests share Redis database 0 with the dev server, so
clearing rl:* also resets dev counters. A separate Redis db index for
tests would fix it (small redis.ts change), deferred.

**Commit:** `test(api): share a guarded test setup and clear rate-limit counters between runs`

## 2026-09-22 — Day 12 — File 055: apps/api/tests/courses.test.ts, submissions.test.ts

**What we built:** 27 permanent tests for Phase 3: courses.test.ts (14:
courses and assignments) and submissions.test.ts (13: upload, race,
rate limit, reading). File 047 revisit: updateAssignment logs
modifiedPaths(), the fields that really changed, instead of the keys
that were sent.

**Why we built it:** Every Phase 3 feature had only been checked by
throwaway scratch files. These keep each decision re-checked on every
npm test, and settle two owed items: the race's 409 and the
exaggerating update log.

**Why a separate file:** Courses and assignments are structure;
submissions are evidence. Two files so a failure names the area. Both
use helpers.ts, so neither contains setup or a copy of the guard.

**Libraries introduced:** None.

**Functions written:** submit, asBytes, idOf (test helpers).

**Concepts learned:** regression test · flaky test · invariant

**Decision made — assert invariants, not timings.** The race test
accepts 201+409 or 201+201, but always requires: any non-201 is the
409 "in progress", records equal the number of 201s, and files equal
records. Demanding exactly one 409 would make a flaky test.

**Decision made:** the rate-limit test layers limits (5 stored, 5
refused with 409, then 429), proving the limiter counts refused
uploads too.

**Verified:** npm test, 42 passed across 3 files; race statuses printed;
the update log shows "changes":["title"] for a request that also resent
an unchanged language.

**Gaps:** the log line itself isn't asserted (capturing pino in tests
isn't worth it yet); admin downloads and pagination beyond page 1
aren't tested.

**Commit:** `test(api): add course, assignment and submission tests; log only fields that changed`

## 2026-09-22 — Day 12 — Phase 3 closed (Files 041–055)

Courses (enrolment by roll number, archiving), assignments (timezone-
safe deadlines, provenance and language locked after submissions),
submissions (upload checks, MinIO storage with compensation,
race-safe attempts, downloads), a shared access service, Redis rate
limiting, and 42 automated tests.

Carried into Phase 4: the /refresh message (now a one-argument change
via tokenInvalid(message)); trimming pino-http's logged headers;
app.set("trust proxy", 1) at deployment; a separate Redis db index for
tests; the MONGO_DB variable check; orphan cleanup.

## 2026-09-24 — Day 14 — File 056: apps/api/src/queue/detectionQueue.ts — Phase 4 begins

**What we built:** A BullMQ queue on the existing Redis, with
enqueueDetection(submissionId, reason) and closeQueue(). File 051
revisit: createSubmission enqueues after storing, and sets the status
to "queued" only if the job was really added.

**Why we built it:** Storing an upload takes about 30ms; analysing it
takes seconds. The request must hand the work over and return. The
queue also brings retries, crash safety and a status students can see.

**Why a separate file:** The controller should say "this needs
analysing" and know nothing about Redis keys or backoff. The API and
the worker are different processes and must agree on the queue name
and options, so both import them from here.

**Libraries introduced:** bullmq. Rejected: Agenda (polls MongoDB;
we already run Redis), RabbitMQ (a second service for one queue), and
a hand-rolled Mongo queue (re-implements retries, locks and atomic
claiming, which BullMQ does in Lua inside Redis).

**Functions written:** enqueueDetection (never throws), closeQueue.

**Concepts learned:** job queue · producer/consumer · backoff ·
idempotent enqueue · blocking read · dead letter

**Decision made — the worker is a separate process.** Challenged on
performance grounds, and the answer is the opposite: in one process
Node's single thread makes the API and the analysis take turns, so
logins queue behind tree math. In two processes they use different
cores. The real speed levers are worker concurrency (057), fewer
candidate pairs (063) and detector-side pruning (062).

**Decision made — a second Redis connection.** BullMQ requires
maxRetriesPerRequest: null because its workers block waiting for
jobs; the shared client from File 038 uses 3 and is rejected outright.

**Decision made — jobs carry ids, never content.** Job data lives in
Redis and is serialised on every read. The worker re-reads the record,
so nothing can be stale.

**Decision made — enqueue failure is not upload failure.** The file is
stored and the record exists; a Redis blink leaves the submission as
"uploaded" rather than losing a student's work. The status only claims
"queued" when it is true.

**Open gap:** Redis is not persisted in our compose file, so a Redis
restart loses queued jobs and those submissions stay "queued" with no
job. Phase 5 needs an admin action to re-queue stuck submissions.

**Commit:** `feat(api): add detection queue and enqueue submissions on upload`

## 2026-09-24 — Day 14 — File 057: apps/api/src/worker.ts

**What we built:** The second process. A BullMQ Worker with concurrency 2
that loads the submission, guards against a missing or already-analysed
record, marks it "analyzing", fetches the bytes from MinIO, and hands
them to a detector that does not exist yet. Plus setStatus(), graceful
shutdown on SIGINT/SIGTERM, and an npm run worker script.

**Why we built it:** File 056 produced jobs and nothing consumed them.
This is also where a failure becomes visible on the record instead of
vanishing into a log.

**Why a separate file:** A different entry point from server.ts. One
starts an HTTP listener, the other a job consumer; they share env,
connectDb, the models and the storage client, and neither imports the
other.

**Functions written:** analyse(job), setStatus, start, shutdown.

**Concepts learned:** consumer/processor · concurrency · attemptsMade ·
stalled job · graceful shutdown · idempotent handler

**Decision made — the worker admits it cannot analyse.** The handler
throws "Detector service is not implemented yet", the job retries twice
and the submission ends at "failed" with that reason. Writing a fake
rps of 0 with an "analyzed" status would have looked finished tonight
and would have been a fabricated result in a system whose whole claim
is evidence over verdicts.

**Decision made — autorun: false.** A Worker starts consuming the moment
it is constructed, which could pull a job before connectDb() finished.
The worker now starts consuming only at the end of start(), and
worker.run() is deliberately not awaited because it settles only when
the worker stops.

**Decision made — a retry sets the status back to "queued".** A
submission waiting 25 seconds for its next attempt is queued, not being
analysed. Same rule as the "queued" status in File 056.

**Decision made — failureReason is truncated to 500 characters**, the
schema's limit, so that recording a failure cannot itself fail.

**Decision made — a missing submission returns instead of throwing.**
Retrying a job for a deleted record three times is pointless. Proved by
the stale jobs the test suite left behind, which the worker dropped on
its first run.

**Fixed:** tests/helpers.ts now obliterates the detection queue
alongside the rl:* keys, and closes the queue connection on teardown.
Before this, every test run left real jobs in Redis pointing at wiped
records.

**Fixed:** the /refresh handler said "Access token is invalid" about a
refresh token. Carried since Phase 2, one argument to change.

**Open gap:** a worker killed mid-job leaves the submission at
"analyzing". BullMQ re-runs the stalled job after about 30 seconds, but
if the worker never returns the record is stuck. Phase 5 needs a sweep
for submissions sitting in "analyzing" too long.

**Open gap:** concurrency 2 is a guess, not a measurement. Revisit once
File 062 gives real APTED timings.

**Commit:** `feat(api): add detection worker process, clear queue between tests`

## 2026-09-24 — Day 14 — File 058: apps/api/src/services/detectorClient.ts

**What we built:** The HTTP client for the detector service.
analyzeSubmission() posts source plus candidate sources to /analyze,
validates the reply against a Zod schema, and returns typed data.
pingDetector() checks /health in 2 seconds and never throws. Two new
settings: DETECTOR_URL and DETECTOR_TIMEOUT_MS.

**Why we built it:** The worker needs something to call. This is the one
place that knows the detector's address, the contract, the time limit
and the failure wording.

**Why a separate file:** Timeouts and status codes are not the worker's
job, Files 060 to 063 will change the detector constantly and should
touch one file on the Node side, and it can be tested against a fake
server with no detector in existence.

**Libraries introduced:** none. fetch and AbortSignal.timeout are built
into Node 22, so no axios and no node-fetch.

**Functions written:** postJson, analyzeSubmission, pingDetector.

**Concepts learned:** service client · contract · boundary validation ·
AbortSignal · fail fast · backpressure

**Decision made — validate our own service's response.** We will write
the detector ourselves, and we will break it ourselves. If similarity
ever arrives as the string "0.87" or as 87, the error belongs at the
boundary and not inside an RPS calculation on a student's record.

**Decision made — no retries in the client.** BullMQ already retries
three times with backoff. Retrying here too would mean nine calls per
submission. Retry at exactly one layer.

**Decision made — a timeout and an unreachable service get different
messages.** These strings are stored in failureReason and read by
whoever is asking why a submission has no analysis, so "did not answer
within 30000 ms" and "is unreachable at <url>" must not be merged.

**Decision made — safeParse, not parse.** The Zod error is logged for
us; the thrown message is a plain sentence fit to store.

**Decision made — worker.ts is untouched.** The client exists but there
is still nowhere to put a result. File 064 wires them together, rather
than editing the same line twice.

**Fixed:** authController.ts line 115, inside refresh(), now says
"Refresh token is invalid or has expired". Carried since Phase 2 and
confirmed to be the only tokenInvalid call in that controller; the ones
for /me come from requireAuth and were already correct.

**Open gap:** no request size limit. 50 candidates at 256 KB each would
post 12 MB. File 063 caps the count, and arguably this file should too.

**Open gap:** DETECTOR_URL has no authentication. Acceptable on one
laptop; in deployment the detector must not be reachable from outside
the compose network. File 066.

**Commit:** `feat(api): add detector client with timeout and response validation`

## 2026-09-25 — Day 15 — File 059: apps/detector/app/main.py — the first Python

**What we built:** The detector service. FastAPI with /health and
/analyze, six Pydantic models mirroring the contract the Node client
validates, source and candidate-count limits, and an honest stub that
returns parsed: false with "Parser not implemented yet".

**Why we built it:** File 058 built a client for a service that did not
exist. Agreeing the contract over a real socket first means every later
file changes one function body with the integration already proven.

**Why a separate service:** tree-sitter and APTED are Python libraries
with no serious Node equivalent. It holds no credentials and no database
connection, so it can be restarted and rewritten freely.

**Libraries introduced:** fastapi, pydantic, uvicorn[standard]. Rejected
Flask (the request validation is the contract, and Pydantic gives that
from one definition) and Django REST Framework (no database, no admin,
no users).

**Concepts learned:** ASGI · Pydantic model · Literal · 422
Unprocessable Entity · monotonic clock · lock file

**Bug caught before it happened:** Pydantic serialises an unset optional
as null, and Zod's .optional() accepts a missing key but rejects null.
A response with "nodeCount": null would have failed the client's
validation with a message giving no hint of the cause.
response_model_exclude_none=True omits those keys, so absent means
absent on both sides. This is a cross-language mismatch that only
appears when both halves run together.

**Decision made — def, not async def.** The work ahead is CPU bound.
In an async handler it would block the event loop and stall every other
request; FastAPI runs a plain def in a thread pool instead.

**Decision made — camelCase field names in the wire models.** Unpythonic
and deliberate. The idiomatic alternative needs an alias_generator plus
populate_by_name plus by_alias serialisation, three settings whose
failure mode is a silently dropped field. Internal code from File 060
onward uses snake_case.

**Decision made — parsed: false with a reason, never an empty match list
with parsed: true.** The second claims "I looked and found nothing",
which is a clean bill of health this service has not earned.

**Decision made — the size limits live on the server.** This closes the
gap noted in File 058, and on the correct side: a server that trusts its
clients to behave is not a server.

**Decision made — no Dockerfile yet.** Uvicorn on the host, as the API
runs on the host. Containerising now would add a rebuild to every one of
Files 060 to 063.

**Open gap:** no authentication on the detector, and no HTTP-layer body
size limit. Both belong with deployment.

**Machine note:** the detector runs on port 8090, not the conventional
8000, because another process on this machine holds 8000 with an
exclusive bind. Windows reports that as WinError 10013 "access
forbidden" rather than the usual 10048 "address already in use", which
makes it look like a permissions problem. Get-NetTCPConnection
-LocalPort 8000 names the real owner. The port lives in infra/.env as
DETECTOR_URL, written as 127.0.0.1 rather than localhost, since
localhost resolves to ::1 first on Windows while uvicorn binds IPv4.

**Commit:** `feat(detector): add FastAPI service with the analyze contract`

## 2026-09-25 — Day 15 — File 060: apps/detector/app/parsing.py — the first real analysis

**What we built:** Source text into a tree-sitter syntax tree.
parse_source() returns a ParseResult with the root node, a named-node
count, and an error naming the first broken line. /analyze now reports
real parse results, and the contract gained a "compared" field.

**Why we built it:** Comparing trees instead of text is the whole idea
of Layer 1. Renaming every variable and reordering every function
changes the text completely and the tree barely at all.

**Why a separate file:** parsing is a pure function of source text, so
it stays testable without a server. Files 061 and 062 both need a tree
and import it from here rather than from the web layer.

**Libraries introduced:** tree-sitter, tree-sitter-python,
tree-sitter-java. Rejected Python's built-in ast module: it parses
Python only, and CodeGuard supports Java too. One parsing approach for
both languages is worth a lot.

**Functions written:** parse_source, count_named_nodes,
first_error_line.

**Concepts learned:** concrete vs abstract syntax tree · named node ·
ERROR node vs missing node · error recovery · byte offset and point ·
compiled extension module

**Decision made — a tree with errors is reported, not scored.**
tree-sitter is deliberately error tolerant and returns a tree for code
that does not compile, but that tree has arbitrary structure and
comparing it produces a meaningless number. The cost: a student whose
file has one missing colon gets no structural analysis. The alternative
of comparing anyway with a low-confidence flag stays open.

**Decision made — count named nodes only.** Punctuation tokens are in
the tree but carry no meaning. The named count still means the same
thing after File 061 normalises, and it predicts APTED's cost.

**Decision made — a stack, not recursion.** Python's recursion limit is
1000 frames, so a deeply nested file would crash the parser. A crash
caused by the input is the worst kind of bug in a system like this.

**Decision made — the contract gained "compared".** Without it,
parsed: true with an empty match list would claim the cohort had been
checked. The change was safe because File 058 validates the response:
a client that had not been updated would fail loudly instead of reading
a missing field as undefined. That is the return on writing the
validation.

**Decision made — DETECTOR_VERSION is 0.2.0.** Behaviour and contract
both changed, and every DetectionResult stores this string.

**Open gap:** no cap on tree size, and whole files are always parsed in
full. Revisit once File 062 shows what APTED costs.

**First real measurements (25 Sep):** 20 named nodes for a 5-line Python
file, 19 for the Java equivalent, 7,001 nodes and 19.4 ms for 1,500
lines. That is roughly 4.7 nodes per line and 2.8 microseconds per node.
Detector work (19.4 ms) has caught up with HTTP transport (26 ms round
trip); in File 059 the ratio was 0.016 ms against 16 ms.

**Evidence for refusing to score a broken tree:** the Python file with a
missing colon produced 10 nodes against the valid file's 20, so half the
structure was never built. The Java file with a missing semicolon
produced 19 nodes, the same as the valid one. Node count alone cannot
tell you a parse is untrustworthy; the has_error flag can.

**Machine note:** npx tsc is the Go implementation of TypeScript and
type-checks in parallel across every core. On this machine that
exhausted the Windows commit limit and crashed with errno 1455,
ERROR_COMMITMENT_LIMIT, while failing to allocate 8 KB. systeminfo
showed 27.8 GB of 29.7 GB in use with 1.9 GB free. Workaround:
$env:GOMAXPROCS=4 before npx tsc. Real fix: let Windows manage the
paging file.

**Commit:** `feat(detector): parse submissions into syntax trees with tree-sitter`

## 2026-09-25 — Day 15 — File 061: apps/detector/app/normalise.py

**What we built:** Tree normalisation. Every identifier becomes ID,
every number NUM, every string STR, comments are dropped, literals are
treated as leaves, and a two-item pass-through list removes meaningless
wrappers. Produces a TNode tree that keeps line numbers, plus size() and
to_bracket() for the format APTED reads.

**Why we built it:** A raw tree still contains every name and number, so
two files differing only in variable names produce different trees. This
is where "renaming everything does not help you" stops being a claim in
the report and becomes measurable. It also shrinks the tree, and tree
edit distance costs roughly the product of the two tree sizes.

**Why a separate file:** parsing.py answers "is this valid code?", this
answers "what shape is it?". Every rule here is a judgement about what
counts as the same code, and those judgements are the intellectual core
of Layer 1.

**Libraries introduced:** none.

**Functions written:** label_for, normalise, size, to_bracket.

**Concepts learned:** normalisation · canonical form · invariance ·
bracket notation · pass-through node · leaf

**Decision made — literals are leaves.** Once a node becomes STR we do
not look inside, so string internals and escape sequences stop
contributing noise.

**Decision made — the pass-through list is tiny and explicit.** A
general "collapse any single-child node" rule would be cleverer and
would silently merge constructs that are not the same. Every rule here
has to be explainable to an examiner asking why two files scored 0.9.

**Decision made — a depth cap of 200 with a DEEP leaf.** Depth grows
with nesting rather than file length, so 200 is far past real code, but
a thousand chained operators would exceed Python's recursion limit and
crash the detector. A crash caused by a submission is the worst kind of
bug in this system.

**Decision made — keep line numbers on every node although nothing uses
them yet.** The spans field in DetectionResult needs them, and showing
faculty which lines matched is what makes this evidence rather than a
score.

**Decision deferred — function reordering.** Ordered tree edit distance
treats "A then B" and "B then A" as different, so shuffling methods
lowers the score unfairly. Canonical sorting here, or function-level
matching in File 062, would both fix it and both add real complexity.
Measure the damage once File 062 runs, then decide. Building the
mitigation before measuring the problem is how projects acquire code
nobody can justify.

**Open gap:** the literal and identifier type sets are hand-written and
certainly incomplete (Java text blocks, some Python string forms). A
missed type stays as its raw name, which is a quiet loss of invariance
rather than a crash.

**Open gap:** normalising all literals throws away real evidence. Two
students using the same unusual constant is a genuine signal. Layer 1
loses it; the exact-hash check and Layer 2 still see it.

**Commit:** `feat(detector): normalise syntax trees so renaming changes nothing`

## 2026-09-25 — Day 15 — File 062: apps/detector/app/similarity.py

**What we built:** Tree edit distance between two normalised trees,
turned into a 0 to 1 similarity. prepare() converts a tree once so it
can be compared many times; compare() returns similarity, raw distance,
both sizes and a timing, or None when a pair is too large.

**Why we built it:** Every structural score in the project comes through
this one function.

**Why a separate file:** the algorithm is one question and what to
compare is another. It is also the only file that touches the APTED
library, so replacing that implementation later changes one file.

**Libraries introduced:** apted. Rejected zss (older Zhang-Shasha,
slower on these tree shapes) and writing it by hand: a subtly wrong
tree edit distance produces plausible wrong numbers, which is the worst
failure mode this project could have.

**Functions written:** prepare, compare.

**Concepts learned:** tree edit distance · APTED · normalised distance ·
quadratic cost · calibration · cohort z-score

**Decision made — divide by the sum of the two sizes.** The worst
possible edit deletes every node of one tree and inserts every node of
the other, so that sum is the maximum distance and the result lands in
0 to 1 with no clamping. The cost is a compressed scale: two trees of
the same shape with different labels score about 0.5, and after
normalisation most labels are shared because all code uses the same
vocabulary of statements. This is why cohortZScore is a required field
on every match: a raw 0.7 means nothing until you know the class sits
at 0.45.

**Decision made — return distance and both sizes, not only the
similarity.** If the formula turns out wrong, a different one can be
computed without re-running the expensive part.

**Decision made — refuse a pair whose size product exceeds four
million.** Quadratic cost means a large pair is not slightly slower but
catastrophically slower. Returning None rather than raising lets File
063 record an honest skipped status with a reason.

**Decision made — prepare() separate from compare().** One submission
will be compared against up to fifty candidates, and converting its tree
inside compare() would redo that work fifty times.

**Plan changed:** function-level comparison chosen over whole-file, so
File 062 now covers pair similarity only and File 063 covers function
extraction, matching and aggregation. Later files shift by one.

**Open gap:** MAX_PRODUCT of four million is a guess, not a measurement.

**Open gap:** every edit costs one, so deleting a whole function costs
the same as deleting one identifier. APTED supports custom costs; there
is no evidence yet that they would help.

**Measured, 25 Sep:** identical and renamed both 1.0. One line added
0.875, logic changed 0.794, unrelated code 0.581. Reordering three
functions in a file compared against itself: two swapped 0.796, fully
reversed 0.727. Timing: 44 nodes 13 ms, 781 nodes 8,510 ms, which is
about n^2.3.

**Consequence — unrelated code scores 0.58, not near zero.** All code
shares the same vocabulary of node types, so raw similarity is close to
meaningless alone. This is the empirical justification for cohortZScore
being a required field.

**Consequence — a class of 60 is 1,770 pairs, so whole-file comparison
would take 4 hours 11 minutes per assignment.** Candidate selection is
therefore the most important remaining file, not an optimisation.

**Correction — my MAX_PRODUCT of 4,000,000 was wrong by about fifty
times.** Lowered to 150,000 on the measurement above.

**Correction — the performance argument for function-level comparison
was wrong.** f comparisons of trees of size n/f cost f^2 (n/f)^2 = n^2,
exactly the same as one comparison of size n; the f^2 pairs cancel the
smaller trees. At the measured exponent of 2.3 it buys a factor of about
two. Function-level remains correct for reordering invariance (0.727 to
1.0) and for spans, which is why it was chosen, but it does not solve
the cost problem.

**Commit:** `feat(detector): compute tree edit distance similarity with APTED`

## 2026-09-26 — Day 16 — File 063: apps/detector/app/units.py

**What we built:** Function-level comparison. extract_units() pulls every
function and method out of a normalised tree; compare_unit_sets() prunes
impossible pairs, compares the rest, matches greedily strongest first,
and aggregates into a file score weighted by node count. Each match
carries both line ranges, which is a Span. Coverage reports how much of
each file was inside a function at all. similarity.py gained a
bracket-string early exit and MAX_PRODUCT dropped to 150,000.

**Why we built it:** whole-file comparison scored a file against itself
at 0.727 when three functions were reordered. Matching by content rather
than position removes that, and produces the line ranges that make this
evidence rather than a score.

**Why a separate file:** similarity.py answers how alike two trees are;
this answers which parts correspond and what that says about the files.
The arguable decisions — greedy or optimal pairing, how to weight,
what to do with unmatched code — all live here.

**Libraries introduced:** none, deliberately.

**Functions written:** extract_units, ceiling_for, compare_unit_sets,
compare_files.

**Concepts learned:** comparable unit · assignment problem · admissible
bound · weighted mean · coverage

**Decision made — prune by a provable ceiling, not a guess.** Turning a
10-node tree into a 100-node tree needs at least 90 edits, so distance
is at least the size gap and similarity is at most 1 - gap/(na+nb). A
pair whose ceiling falls under 0.5 cannot matter, since unrelated code
already measures 0.58. Nothing approximate is discarded.

**Decision made — compare bracket strings before running APTED.** Once
normalised, copied code is usually the same string, and string equality
costs microseconds against seconds. Exact copying is the commonest real
case, so this is the optimisation most likely to matter in practice.

**Decision made — greedy matching rather than optimal.** The Hungarian
algorithm would be exact but needs scipy, the first heavyweight
dependency in the detector, for a difference that only appears when
scores are close. Revisit when Layer 2 needs numpy anyway, and test it
before adopting it.

**Decision made — unmatched units count in the denominator only.** A
student who copied three functions and wrote seven gets a score
reflecting the proportion. Identical files still score exactly 1.0.

**Decision made — report coverage instead of hiding it.** Module-level
code outside any function is not compared, so faculty are told how much
of the file was examined rather than shown a confident number about
half a file.

**Open gap:** module-level code is invisible to Layer 1 when a file also
has functions. A student could hide copied logic there. Phase 5.

**Open gap:** the f-squared problem is untouched. Sixty functions
against sixty is 3,600 pairs; this file cut what a pair costs, not how
many pairs there are. The pair count across submissions is File 064.

**Measured, 26 Sep:** fully reordered file against itself now scores 1.0
(0.727 whole-file yesterday). Renamed and reordered together also 1.0.
Every match carries both line ranges, which are Spans.

**The short-circuit is worth about 3,000x.** 3,600 pairs of identical
bracket strings took 2.3 ms; 2,700 pairs needing APTED took 5,580 ms,
about 2.07 ms each on trees of 10 to 20 nodes.

**The cost model changed.** At whole-file granularity the cost is the
algorithm: one call, 8.5 s, genuinely quadratic. At function
granularity the algorithm is nearly free and the cost is the number of
calls: 2,700 calls of 2 ms. Two milliseconds for a twenty-node tree is
pure-Python constant overhead, not work. Function-level came out 1.5x
faster overall, matching the corrected algebra of about 2x.

**The size prune never fired, in any case.** Functions within one file
have similar sizes, so the worst ceiling was 0.667 against a floor of
0.5. The bound is sound but size alone does not separate function
pairs. Raising the floor would trade speed for silent false negatives,
since an unmatched unit scores zero in the aggregate. The prune stays
as a guard against pathological pairs only.

**Small units match each other spuriously.** "return x + 1" against
"return n * n" scored 0.944, because both are one-line functions and
both operators normalise to binary_operator. Node-count weighting makes
it harmless to the aggregate, but it would appear in the spans list
shown to faculty as though it were evidence. Matches below about 10
nodes should not be reported, only counted. For File 065.

**Consequence:** a realistic assignment of 10 functions per file costs
about 0.2 s per file pair, so roughly 6 minutes for a class of 60. A
60-function file costs 5.6 s per pair, roughly 2 hours 45 minutes.
File 064 must cut the number of APTED calls at two levels: which
submissions to compare at all, and which units within a chosen pair.
Both can use one cheap scorer over the multiset of node labels.

**Commit:** `feat(detector): match files function by function instead of whole file`

## 2026-09-26 — Day 16 — File 064: apps/detector/app/prefilter.py

**What we built:** A cheap approximate scorer over the multiset of node
labels. label_counts() reduces a tree to "how many of each kind of node";
quick_similarity() is 2 x shared / total over two such bags; rank()
returns the most promising candidates. units.py now compares each unit
against only its top five, and compare_unit_sets gained a top_k
parameter so the prefilter can be switched off for testing.

**Why we built it:** yesterday measured 2.07 ms per APTED call on
twenty-node trees. The algorithm is no longer the cost; the number of
calls is. Sixty functions against sixty is 3,600 calls and 5.6 seconds
for a single pair of files.

**Why a separate file:** this is a heuristic, explicitly allowed to be
wrong, whose only job is ranking. similarity.py has to be right; this
has to be fast. Keeping them apart stops anyone treating the cheap
number as a result.

**Libraries introduced:** none. collections.Counter is exactly a
multiset.

**Functions written:** label_counts, quick_similarity, rank.

**Concepts learned:** heuristic · multiset · Sørensen-Dice coefficient ·
shortlist · recall · two-stage filtering

**Decision made — throw away the shape for ranking.** Structure is what
costs; you do not need structure to tell plausible from hopeless.

**Decision made — the prefilter must be switchable.** top_k=None reruns
every pair, so "does this change any score?" has a measured answer
rather than an opinion. A heuristic you cannot switch off is one you
cannot validate.

**Decision made — no filtering when a file has five or fewer
functions.** Small files behave exactly as before, and the prefilter
engages only where the cost lives.

**Open gap:** unlike the size-gap prune this is not a provable bound. A
filtered-out pair shows up as a slightly lower score, never as an
error, which is the most dangerous failure mode in this project.
TOP_K_UNITS of five is a guess until measured.

**Open gap:** submission-level candidate selection is not wired yet. The
ranking function exists; File 065 uses it. For large cohorts the real
answer is storing label counts in Mongo so ranking never touches the
files. Phase 5.

## 2026-09-26 — Day 16 — File 064 revised: starvation in the prefilter

**What went wrong:** the first version shortlisted in one direction only.
Every unit of A nominated its best five in B, and when many units of A
have the same best matches, most of B is never nominated by anyone.
Those units of A then have no candidates left after greedy matching and
go unmatched, scoring zero in the numerator while keeping their full
weight in the denominator. On 30 functions against 30 with 10 shared,
the score fell to 0.3102; on 60 varied functions the same thing happened
through ties, since fifteen identical units all nominated the same few.

**How it was caught:** the top_k=None switch, which reruns every pair, so
the test could compare prefiltered against exhaustive. A heuristic that
cannot be switched off cannot be validated, and this one would have
shipped silently and lowered every score on real submissions.

**The fix:** shortlist_pairs() nominates from both sides and compares the
union, so every unit on both sides appears in at least top_k pairs and
none can be crowded out by another's choices. Roughly twice the cheap
scores and twice the APTED calls, which is the right trade: a heuristic
that changes scores is not fast, it is wrong.

**Also changed:** pairs are iterated in sorted order, so timings and
tie-breaking do not vary between runs, and shortlisted_out is now all
possible pairs minus the pairs actually examined.

**Process note:** the first version was committed while the test printed
"*** MOVED ***" twice, against the stop condition. The gate exists so
that a commit message cannot claim something the evidence contradicts.

**Speed before the fix:** 3,600 calls and 4,267 ms fell to 300 calls and
7 ms; 900 calls and 1,466 ms fell to 150 calls and 98 ms. Both were
wrong. Re-measure after the fix.

## 2026-09-26 — Day 16 — File 064, third attempt: matching and scoring are different jobs

**Two wrong attempts first.** Version one shortlisted each unit's best
five in one direction; version two did it from both sides. Both failed
the same way, and the score said so exactly: 0.3333 on sixty units means
twenty matched. The sixty test functions come from four body patterns,
so each pattern is a fifteen-way exact tie; rank() breaks ties by index,
so all fifteen units nominate the same five partners, and going
bidirectional changed nothing because both sides sort identically. Five
matched per group, four groups, twenty of sixty.

**Ties are not a synthetic artefact.** Sixty students writing the same
assignment produce dozens of near-identical functions. For a plagiarism
detector, ties are the normal case, so a design that breaks on them is
useless.

**The real insight: matching and scoring are different jobs.** Deciding
which function corresponds to which needs only relative ordering, so the
cheap label score can do it, over every pair, where nobody can be
starved. Deciding how similar a matched pair really is needs accuracy,
so APTED runs once per matched pair. Sixty calls instead of 3,600.

**What that moves rather than removes:** the cheap score may pair a unit
with the wrong partner, so a match scores lower than the best available
pairing would. Bounded, and measured directly by the exhaustive A/B. If
it costs too much, the next step is APTED on each unit's top two
alternatives, keeping the better.

**Also:** the A/B now prints both scores when they differ, instead of
one. Reconstructing the gap by arithmetic was avoidable.

**Process note:** two commits went out while the test printed MOVED. The
test and the git commands should never share a paste buffer; the commit
is a decision made after reading the output.

**Commit:** `feat(detector): shortlist unit pairs with a cheap label-overlap score`

## 2026-09-26 — Day 16 — File 065: /analyze becomes a pipeline

**What we built:** /analyze now parses the submission, normalises it,
extracts its functions, ranks the candidates it was given by cheap label
overlap, compares the best ten properly, and returns matches sorted
strongest first with line spans. Contract gained candidatesCompared;
DETECTOR_VERSION is 0.3.0. UnitMatch carries node counts so spans can be
filtered.

**Why we built it:** five files each did one thing and nothing connected
them. This is the first point at which the detector answers the question
the project exists to ask.

**Why main.py orchestrates only:** every judgement about how to compare
lives in the files below it, so the HTTP layer reads top to bottom as a
description of the method: parse, normalise, extract, rank, compare,
report.

**Decision made — MAX_DEEP_CANDIDATES of 10.** The same rank() used for
units now chooses which of up to fifty classmates earn the expensive
treatment. One mechanism at two scales.

**Decision made — MIN_SPAN_NODES of 10, a reporting threshold separate
from the counting threshold.** "return x + 1" against "return n * n"
scored 0.944 yesterday; it still counts toward the file score, weighted
by its tiny size, but it will not be shown to a human as a finding.
Conflating what counts with what is reported is how a tool loses
faculty's trust.

**Decision made — compared is len(candidates) > 0, not a hard true.**
With nothing to compare against, nothing was attempted.

**Decision made — nodeCount keeps meaning the raw named-node count.**
The normalised size would arguably be more useful, but the field has
meant one thing since File 060 and silently changing what a field means
is worse than reporting a less useful number.

**Open gap:** candidate ranking has no exhaustive A/B behind it, unlike
the unit matcher. It could be dropping the real copier at position
eleven and nothing would say so. File 067.

**Open gap:** nothing is parallel, and the target file is re-parsed on
every request, so across an assignment each file is parsed about eleven
times.

**Commit:** `feat(detector): turn /analyze into the full Layer 1 pipeline`

## 2026-09-26 — Day 16 — File 066: apps/api/src/services/detection.ts

**What we built:** The Node side of Layer 1. runDetection() finds the
latest attempt of every other student on the assignment, fetches their
files from MinIO, calls the detector, checks contentHash for an exact
duplicate, computes RPS, and writes a DetectionResult with per-layer
statuses and a revision. The worker's placeholder throw is gone.
DetectionResult gained cohortSampleSize and cohortComputedAt.

**Why a separate service:** the worker's job is lifecycle — pick up,
mark, retry, record failure. Detection is domain logic, and if they
shared a file neither could be tested without the other.

**Functions written:** findCandidates, loadSources, runDetection.

**Concepts learned:** denormalisation · revision · renormalised
weighting · cohort · idempotent re-run

**Decision made — RPS is renormalised over the layers that ran.** With
w1 at 0.4 and Layers 2 and 3 absent, treating a missing layer as zero
would cap a verbatim copy at 0.4, below the 0.5 review threshold: the
system would find a perfect copy and decline to flag it. RPS therefore
equals the structural score today, the per-layer statuses record why,
and configVersion and detectorVersion make it traceable when Layer 2
changes the meaning.

**Decision made — the duplicate check runs in Node, not the detector.**
contentHash is byte-exact; a detector similarity of 1.0 only means the
normalised trees match, and two different files can normalise
identically. exactDuplicateOf should mean exactly what it says.

**Decision made — cohortZScore is written as zero with its sample size.**
The schema requires the field, so something must be written; a
plausible-looking number would be worse than an obviously uninformative
one. File 067 refreshes both in place.

**Decision made — only the latest attempt per student is a candidate.**
Earlier attempts would fill the list with near copies of work already
there, and a student's own resubmission is not evidence about anyone.

**Decision made — revision handling is read-then-write, and the unique
index on {submission, revision} is the lock.** Two workers racing both
try to write revision 2; the index rejects one, the job retries, and by
then the winner has committed. Same pattern as the upload race in File
051.

**Open gap:** the 50-candidate cap picks effectively at random for a
larger class, and up to 50 files are fetched from MinIO per submission,
roughly 3,000 fetches across a 60-student assignment. Both are solved by
storing the label-count fingerprint in Mongo. Phase 5.

**Open gap:** a course with no DetectionConfig row falls back to
configVersion 1, indistinguishable from a real version 1. Harmless,
since a real version 1 holds the same defaults.

**Commit:** `feat(api): run detection and store a DetectionResult`
