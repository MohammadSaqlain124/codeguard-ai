# Deploying CodeGuard AI

Written 15 November 2026, for the first deployment.

This is a demo deployment, not a production topology. Two compromises are
deliberate and both are called out where they appear: the API and the
detection worker share one process, and every service is on a free tier that
sleeps when idle.

## What goes where

| Piece | Host | Why |
|---|---|---|
| MongoDB | MongoDB Atlas, M0 free | The only free managed Mongo with a real connection string |
| Submission files | the same Atlas cluster | Uploads are capped at 1 MB and a Mongo document holds 16 MB, so object storage was a dependency we did not need |
| Redis | Render Key Value, free | BullMQ needs Redis, and this one sits on Render's private network beside the API |
| Detector | Render web service, Docker | Builds from `apps/detector/Dockerfile`, no model weights needed |
| API + worker | Render web service, Node | One service, two processes |
| Web | Render static site | Vite build, no server needed |

Two external accounts, Atlas and Render. Nothing else.

Layer 3 is measured offline and is not wired into the request path, so nothing
here needs CodeBERT, torch or a GPU. The detector image is seven pinned
dependencies.

## Order matters

Each step produces something the next one needs.

### 1. MongoDB Atlas

Create a free M0 cluster. Atlas now does the user and the IP list together in
a Security Quickstart panel while the cluster provisions.

- **Database user:** username and password auth. The quickstart grants
  `readWriteAnyDatabase`, which is enough. If Atlas auto-creates a user with
  Atlas Admin, replace it with one scoped to read and write, and delete the
  auto-created one.
- **Network Access:** `0.0.0.0/0`. Render free services have no fixed outbound
  IP, so an allowlist cannot be narrowed. This is the one place the deployment
  is weaker than the local stack, and it is worth saying out loud in the viva
  if anyone asks about it.
- **Connect > Drivers > Node.js:** copy the connection string.

**The database name has to be in the URI path.** `connectDb()` calls
`mongoose.connect(env.MONGO_URI, ...)` and passes no `dbName`, so the database
the app uses is whatever the URI says and nothing else. The local URI ends
`/codeguard?authSource=admin`, which is why this has never come up.

Atlas hands you a string with an empty path:

```
mongodb+srv://user:pw@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Insert the database name before the `?`:

```
mongodb+srv://user:pw@cluster0.xxxxx.mongodb.net/codeguard?retryWrites=true&w=majority
```

Paste it as-is and mongoose silently uses a database called `test`. The app
works, the seed works, and the viva question "which database is this?" has an
embarrassing answer.

`MONGO_DB=codeguard` must still be set, because `env.ts` requires it and the
API exits at boot without it. Nothing in the application reads it. That is a
loose end worth tidying after the practical, not now.

### 2. Render Key Value

New > Key Value, free plan. Note the region: **every Render service after this
must use the same one**, or the internal hostname will not resolve.

Use the **Internal** Key Value URL, not the external one. It looks like:

```
redis://red-xxxxxxxxxxxx:6379
```

Which splits into:

```
REDIS_HOST=red-xxxxxxxxxxxx
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
```

The password is genuinely empty and `redis.ts` does `env.REDIS_PASSWORD ||
undefined`, so an empty value means "send no AUTH". One `s` in `redis://` means
no TLS. Inside a private network there is nothing to encrypt against.

Leave the Networking section alone. Enabling external traffic would expose the
instance for no reason: nothing outside Render needs to reach it, and the seed
script in step 8 touches Mongo only.

Optionally turn on **Enable Internal Authentication**. The internal URL then
carries a password, which goes in `REDIS_PASSWORD` with `REDIS_TLS` still
false. Do it before any service connects, or not at all.

### 3. Generate the three secrets

Fresh values, not the development ones. A token minted on a laptop should not
be valid against the deployed system.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it three times, for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and
`DETECTOR_TOKEN`. The two JWT secrets must differ; the schema rejects them if
they match. `DETECTOR_TOKEN` must be at least 32 characters and must be
byte-identical on the API and the detector, or every detector call returns 401.

### 4. Web static site, to reserve its URL

New > Static Site, same repo.

- Root directory: `apps/web`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_BASE=http://localhost:4000` for now

This first build is wrong on purpose. Vite bakes `VITE_API_BASE` into the
bundle at build time, so the real value cannot be set until the API exists.
What this step buys is the URL, which the API needs for CORS. Note it down.

### 5. Detector

New > Web Service, same repo, same region.

- Root directory: `apps/detector`
- Runtime: Docker
- Environment: `DETECTOR_TOKEN` = the value from step 3

The detector raises at import when `DETECTOR_TOKEN` is missing or under 32
characters, so a missing variable shows up as a service that will not start
rather than as one that quietly accepts anything.

Check it: `https://<detector-url>/health` returns
`{"ok":true,"version":"0.4.0"}`. That endpoint needs no token.

If the deploy fails with no open ports detected, override the Docker command:

```
uvicorn app.main:app --host 0.0.0.0 --port 10000 --timeout-graceful-shutdown 30
```

### 6. API and worker

New > Web Service, same repo, same region.

- Root directory: `apps/api`
- Build command: `npm ci && npm run build`
- Start command: `sh -c "node dist/worker.js & node dist/server.js"`

The start command is the compromise. Render's background workers are a paid
feature, so the worker runs as a child of the same service. The consequence is
real and worth knowing before a demo: if the worker dies, the API keeps
answering and submissions sit at status `queued` forever, with nothing
reporting the fault. Locally these are two terminals and you would see it
immediately. If a submission never leaves `queued` on the deployed site,
restart the service.

Environment variables, all of them:

```
NODE_ENV=production
API_PORT=10000
CORS_ORIGIN=<the static site URL from step 4, no trailing slash>
LOG_LEVEL=info

MONGO_URI=<the mongodb+srv string from step 1, with /codeguard in the path>
MONGO_DB=codeguard

REDIS_HOST=<internal hostname from step 2>
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

JWT_ACCESS_SECRET=<step 3>
JWT_REFRESH_SECRET=<step 3, different>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

DETECTOR_URL=https://<detector-url from step 5>
DETECTOR_TIMEOUT_MS=30000
DETECTOR_TOKEN=<step 3, same as the detector>

MAX_UPLOAD_BYTES=1048576
ALLOWED_EXTENSIONS=.py,.java
```

Nineteen variables. There are no `MINIO_*` entries any more: submission files
live in Mongo, and `env.ts` no longer declares them.

`API_PORT=10000` is Render's default port. The process has to bind the port
Render expects or the deploy is marked failed.

`CORS_ORIGIN` with a trailing slash does not match the browser's `Origin`
header, and the failure looks like a broken login rather than a CORS problem.

One consequence of `NODE_ENV=production`: `/api/docs` is not mounted. Swagger
UI is development only, by the comment in `app.ts`, because the spec is a map
of the attack surface. Shubham already has `docs/openapi.yaml`, which is the
same document the UI renders, so nothing is lost. Do not flip this to
`development` to get the docs back.

Check it: `https://<api-url>/health` returns `{"status":"ok","uptime":...}`.

### 7. Rebuild the web with the real API URL

Back on the static site, set `VITE_API_BASE=https://<api-url>` and redeploy.
Any later change to this value needs another build; it is not read at runtime.

### 8. Seed the deployed database

The seed script reads `../../infra/.env`, which is the local file. Do not edit
that file. Make a separate one instead.

Create `apps/api/.env.deploy` holding the same variables as step 6, then:

```
cd E:\Projects\CodeGuard_AI\apps\api
npx tsx --env-file=.env.deploy src/scripts/seed.ts
```

`seed.ts` imports `connectDb` and the models and touches Mongo only, so the
internal Redis hostname being unreachable from your laptop does not matter.
But every variable still has to be present: `env.ts` validates the whole
schema at import and exits if one is missing. It just never connects to them.

`.env.deploy` matches the `.env.*` rule in `.gitignore`. Confirm it before you
push:

```
git check-ignore -v apps/api/.env.deploy
```

If that prints nothing, stop and fix the ignore rule before committing
anything.

## Before you present

Free Render services sleep after about 15 minutes idle, and waking one takes
roughly 50 seconds. Three services means the first click of a cold demo can
sit there for a minute and a half while you are standing in front of the room.

Open all three about five minutes before you start:

1. `https://<detector-url>/health`
2. `https://<api-url>/health`
3. the web URL, and log in

Then leave the tab open. A sleeping service is the single most likely way this
deployment embarrasses you, and it is entirely preventable.

## Smoke test, in this order

1. Web URL loads
2. Log in as a seeded faculty account
3. Create a course and an assignment
4. Submit a `.py` file as a student
5. Watch it go `queued` to `analyzing` to `analyzed`

Step 5 is the real test: it exercises Mongo, the file store, Redis and the
detector in one action.

## If something breaks

| Symptom | Cause |
|---|---|
| Login button does nothing, console shows a CORS error | `CORS_ORIGIN` has a trailing slash or is the wrong URL |
| Login returns a network error, API `/health` is fine | the web bundle was built with the old `VITE_API_BASE` |
| Submission sits at `queued` and never analyses | the worker child process died, restart the API service |
| Every detection fails with a 401 from the detector | `DETECTOR_TOKEN` differs between the two services |
| API deploy marked failed, logs show it listening on 4000 | `API_PORT` is not `10000` |
| API cannot reach Redis | the API service is in a different region from the Key Value instance |
| Mongo connection times out | Atlas Network Access does not have `0.0.0.0/0` |
| Data appears in a database called `test` | the `/codeguard` path is missing from `MONGO_URI` |

## What this deployment does not include

- The Android app, which is not started.
- Self-service password change, so a professor cannot change their own
  password. Accounts are created by the seed script or by an admin.
- Bulk import of the official student list with class and section.
- Any CodeBERT inference. Layer 3 results in the report are measured offline.

## Known loose ends

- `MONGO_DB` is required by `env.ts` and read by nothing.
- `infra/docker-compose.yml` still runs MinIO for the local stack, and
  `infra/.env` still carries the `MINIO_*` values. Both are harmless, since
  nothing reads them any more, and both should be removed after the practical.
- A `render.yaml` blueprint would replace the click-through above. Worth doing
  once there is time to test it.
