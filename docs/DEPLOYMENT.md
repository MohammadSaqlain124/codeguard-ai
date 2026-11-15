# Deploying CodeGuard AI

Written 15 November 2026, for the first deployment.

This is a demo deployment, not a production topology. Two things in it are
deliberate compromises and both are called out where they appear: the API and
the detection worker share one process, and every service is on a free tier
that sleeps when idle.

## What goes where

| Piece | Host | Why |
|---|---|---|
| MongoDB | MongoDB Atlas, M0 free | The only free managed Mongo with a real connection string |
| Redis | Render Key Value, free | BullMQ needs Redis, and this one sits next to the API |
| Submission files | Cloudflare R2, free 10 GB | S3-compatible, so the existing MinIO client talks to it unchanged |
| Detector | Render web service, Docker | Builds from `apps/detector/Dockerfile`, no model weights needed |
| API + worker | Render web service, Node | One service, two processes |
| Web | Render static site | Vite build, no server needed |

Layer 3 is measured offline and is not wired into the request path, so nothing
here needs CodeBERT, torch or a GPU. The detector image is seven pinned
dependencies.

## Order matters

Each step produces something the next one needs. Do them in this order.

### 1. MongoDB Atlas

Create a free M0 cluster, then:

- Database Access: add a user with `readWrite` on the `codeguard` database.
- Network Access: add `0.0.0.0/0`. Render free services have no fixed outbound
  IP, so an allowlist cannot be narrowed. This is the one place the deployment
  is weaker than the local stack, and it is worth saying out loud in the viva
  if anyone asks about it.
- Copy the `mongodb+srv://` connection string. `MONGO_URI` already accepts the
  `+srv` form.

Set `MONGO_DB=codeguard` separately. The database name in the URI path is not
what the app reads.

### 2. Render Key Value

New > Key Value, free plan. Note the host, the port and the password.
Hosted Redis is TLS only, so `REDIS_TLS=true`.

### 3. Cloudflare R2

- Create a bucket called `submissions`.
- Create an API token scoped to that bucket, with object read and write.
- The endpoint is `<your-account-id>.r2.cloudflarestorage.com`, with no
  `https://` prefix and no bucket name in it.

Create the bucket by hand, which you have just done. The API no longer refuses
to boot when it is not allowed to create one, it logs a warning and carries on.
That change is in `apps/api/src/storage/minio.ts`.

R2 signs with region `auto`. Anything else fails with a signature error that
does not mention the region, which is why `MINIO_REGION` now exists.

### 4. Generate the three secrets

Fresh values, not the development ones. A token minted on a laptop should not
be valid against the deployed system.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it three times, for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and
`DETECTOR_TOKEN`. The two JWT secrets must differ; the schema rejects them if
they match. `DETECTOR_TOKEN` must be at least 32 characters and must be
byte-identical on the API and the detector, or every detector call returns 401.

### 5. Web static site, to reserve its URL

New > Static Site, same repo.

- Root directory: `apps/web`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_BASE=http://localhost:4000` for now

This first build is wrong on purpose. Vite bakes `VITE_API_BASE` into the
bundle at build time, so the real value cannot be set until the API exists.
What this step buys is the URL, which the API needs for CORS. Note it down.

### 6. Detector

New > Web Service, same repo.

- Root directory: `apps/detector`
- Runtime: Docker
- Environment: `DETECTOR_TOKEN` = the value from step 4

The detector raises at import when `DETECTOR_TOKEN` is missing or under 32
characters, so a missing variable here shows up as a service that will not
start rather than as a service that quietly accepts anything.

Check it: `https://<detector-url>/health` returns
`{"ok":true,"version":"0.4.0"}`. That endpoint needs no token.

### 7. API and worker

New > Web Service, same repo.

- Root directory: `apps/api`
- Build command: `npm ci && npm run build`
- Start command: `sh -c "node dist/worker.js & node dist/server.js"`

The start command is the compromise. Render's background workers are a paid
feature, so the worker runs as a child of the same service. The consequence is
real and worth knowing before a demo: if the worker dies, the API keeps
answering and submissions sit in the queue at status `queued` forever, with
nothing reporting the fault. Locally these are two terminals and you would see
it immediately. If a submission never leaves `queued` on the deployed site,
restart the service.

Environment variables, all of them:

```
NODE_ENV=production
API_PORT=10000
CORS_ORIGIN=<the static site URL from step 5, no trailing slash>
LOG_LEVEL=info

MONGO_URI=<the mongodb+srv string from step 1>
MONGO_DB=codeguard

REDIS_HOST=<from step 2>
REDIS_PORT=<from step 2>
REDIS_PASSWORD=<from step 2>
REDIS_TLS=true

MINIO_ENDPOINT=<account-id>.r2.cloudflarestorage.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ROOT_USER=<R2 access key id>
MINIO_ROOT_PASSWORD=<R2 secret access key>
MINIO_BUCKET=submissions
MINIO_REGION=auto

JWT_ACCESS_SECRET=<step 4>
JWT_REFRESH_SECRET=<step 4, different>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

DETECTOR_URL=https://<detector-url from step 6>
DETECTOR_TIMEOUT_MS=30000
DETECTOR_TOKEN=<step 4, same as the detector>

MAX_UPLOAD_BYTES=1048576
ALLOWED_EXTENSIONS=.py,.java
```

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

### 8. Rebuild the web with the real API URL

Back on the static site, set `VITE_API_BASE=https://<api-url>` and redeploy.
Any later change to this value needs another build; it is not read at runtime.

### 9. Seed the deployed database

The seed script reads `../../infra/.env`, which is the local file. Do not edit
that file. Make a separate one instead, from `apps/api`:

```
cd E:\Projects\CodeGuard_AI\apps\api
```

Create `apps/api/.env.deploy` holding the same variables as step 7, then:

```
npx tsx --env-file=.env.deploy src/scripts/seed.ts
```

`.env.deploy` matches the `.env.*` rule in `.gitignore`, so it will not be
committed. Confirm that before you push:

```
git check-ignore -v apps/api/.env.deploy
```

If that prints nothing, stop and fix the ignore rule before committing
anything.

## Before you present

Free Render services sleep after about 15 minutes idle, and waking one takes
roughly 50 seconds. Three services means the first click of a cold demo can sit
there for a minute and a half while you are standing in front of the room.

Open all three about five minutes before you start:

1. `https://<detector-url>/health`
2. `https://<api-url>/health`
3. the web URL, and log in

Then leave the tab open. A sleeping service is the single most likely way this
deployment embarrasses you, and it is entirely preventable.

## If something breaks

| Symptom | Cause |
|---|---|
| Login button does nothing, console shows a CORS error | `CORS_ORIGIN` has a trailing slash or is the wrong URL |
| Login returns a network error, API `/health` is fine | the web bundle was built with the old `VITE_API_BASE` |
| Upload returns 503 storage unavailable | R2 credentials, endpoint spelling, or `MINIO_REGION` is not `auto` |
| Submission sits at `queued` and never analyses | the worker child process died, restart the API service |
| Every detection fails with a 401 from the detector | `DETECTOR_TOKEN` differs between the two services |
| API deploy marked failed, logs show it listening on 4000 | `API_PORT` is not `10000` |
| Mongo connection times out | Atlas Network Access does not have `0.0.0.0/0` |

## What this deployment does not include

- The Android app, which is not started.
- Self-service password change, so a professor cannot change their own
  password. Accounts are created by the seed script or by an admin.
- Bulk import of the official student list with class and section.
- Any CodeBERT inference. Layer 3 results in the report are measured offline.
