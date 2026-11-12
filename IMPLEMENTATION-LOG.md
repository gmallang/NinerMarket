# Implementation log — 2026-11-11

Phase 1 of the 2.0 brief: audit plus the verified **production reliability** slice only.
No deploy, commit, push, or production data change.

## Starting state

- Branch `main` @ `51f1b35`, working tree clean except untracked `MARKETPLACE-GAPS.md`,
  `RATE-LIMITS.md`, `backend-dev.log`, `frontend-dev.log` (left untouched).
- Production `zzytuzbemlfzuoclquua`: `users.posting_flagged`, `flag_reason`,
  `bad_listing_streak` previously missing (`42703`), now present (`200`) — verified before
  writing any migration, per the brief's "never assume a migration was applied".

## Changes

### 1. `Backend/observability.py` (new)

- `RequestContextMiddleware` (pure ASGI): stamps `X-Request-Id` (re-echoes a well-formed
  client value, otherwise a 16-char id; anything with unsafe characters is replaced so a
  request cannot forge log lines), catches unhandled exceptions, returns
  `{"detail","error","request_id"}` JSON, logs the traceback with the id, and logs one line
  per request (skipped for `/healthz`, `/readyz`).
- `JsonFormatter` + `configure_logging()` behind `LOG_JSON=1`; no behaviour change otherwise.
- Tracks whether the response already started, so a streaming failure cannot produce a second
  response on the same connection.

### 2. `Backend/main.py`

- Middleware registration order made explicit and commented: `RequestContextMiddleware`
  **before** `CORSMiddleware`, because Starlette runs the last-added middleware outermost —
  this is what keeps CORS headers on 500s.
- `GET /healthz` — liveness, touches nothing external.
- `GET /readyz` — memory store: always ready. Supabase: runs the cached schema check and
  returns 503 while the schema is behind. Missing names are logged, never returned.

### 3. `Backend/schema_check.py` (new)

- `EXPECTED` lists every table/column the backend uses (14 tables).
- Probes PostgREST with `select=<cols>&limit=1`: `200` = present, `42703` = missing column
  (then per-column probes to list them all), `404`/`PGRST205` = missing table.
- 5-minute cache; network failures fail *open* for readiness but are reported as `detail`.
- CLI exit codes: `0` match, `1` drift, `2` could not run.

### 4. `Backend/migrations/` (new)

`001_users_moderation_columns.sql`, `002_account_soft_delete.sql`,
`003_report_queue_and_audit_log.sql`, plus `README.md` documenting the change protocol
(add delta → mirror into `schema.sql` → extend `EXPECTED` → apply → `schema_check.py`) and
the `notify pgrst, 'reload schema'` requirement. Each file is idempotent.

### 5. `Backend/test_observability.py` (new)

Pins: liveness; readiness on the memory store; supplied id echoed; generated id length;
hostile id replaced; unhandled error → 500 JSON with matching `request_id`, exception message
absent; **CORS header present on that 500** (the actual regression).

### 6. `.github/workflows/deploy.yml`

New `verify` job before both deploy jobs: backend suites, live schema check (only when
`SUPABASE_URL`/`SUPABASE_KEY` secrets exist), `tsc -b`, `eslint .`, `vitest run`,
`npm run build`. `deploy-frontend` and `deploy-backend` now `needs: verify`. Hook-triggering
logic and non-secret diagnostics preserved unchanged.

### 7. `Backend/requirements-dev.txt` (new)

`-r requirements.txt` + `httpx` (required by `fastapi.testclient`; not needed at runtime).

## Verification (run locally on Windows/Git Bash)

| Check | Command | Result |
|---|---|---|
| Backend suites | `for t in test_*.py; do python $t; done` | 7/7 exit 0 (`test_admin`, `test_features`, `test_image_moderation`, `test_observability`, `test_posting_limits`, `test_requests`, `test_security`) |
| Schema CLI without credentials | `python schema_check.py` | exit **2**, "schema check could not run: no SUPABASE_URL/SUPABASE_KEY configured" — refuses rather than passing silently |
| Typecheck | `npx tsc -b` | exit 0 |
| Lint | `npx eslint .` | exit 0 |
| Frontend tests | `npx vitest run` | 10 files / 46 tests passed, exit 0 |
| Build | `npm run build` | exit 0 (`index-D0Bcc-Bp.js`, 497 kB / 158.6 kB gzip) |
| Live schema (read-only probe) | `select=<col>&limit=1` with the public anon key | `users.posting_flagged`/`flag_reason`/`bad_listing_streak`/`deleted_at` → `200 []` |

## Not done, on purpose

- **Not deployed.** `/healthz` and `/readyz` are local until you approve a deploy; the CI
  `verify` job is also inert until pushed. Both are pending your approval per the brief.
- **No production data touched.** All Supabase calls were read-only `select` probes; the anon
  key used is the one already public in the frontend bundle, and RLS returns zero rows.
- **Not implemented yet:** account deletion, user blocking/reporting, column-scoped user
  writes, shared-store rate limiting, session revocation, EXIF stripping, native mobile work
  (all scoped in `AUDIT-2.0.md` §2/§3/§7).
- **Not committed:** changes are working-tree only.

## Known limitations of this slice

1. `/readyz` performs up to 14 PostgREST requests once per 5 minutes; on a cold instance the
   first probe is slower than a plain ping (acceptable for readiness, not for liveness).
2. The CI schema gate only runs when repo secrets exist; without them it prints a skip notice.
3. A Vercel-native Git integration, if connected, would bypass the new `verify` gate.
4. `schema_check.py` asserts presence, not types or constraints (e.g. a `text` column where a
   `boolean` is expected still passes).
