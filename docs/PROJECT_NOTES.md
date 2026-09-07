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
