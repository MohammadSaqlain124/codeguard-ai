# CodeGuard AI — Project Notes, 

## Conventions, 

## Entry template

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
