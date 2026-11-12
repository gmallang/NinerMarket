# NinerMarket 2.0 — Production Readiness Audit

**Date:** 2026-11-11 · **Branch:** `main` @ `51f1b35` · **Scope:** reliability, auth/security,
trust & safety, mobile, marketplace experience, analytics.

This is the Phase 1 audit the 2.0 brief asked for: findings only where they are backed by the
code, the live production project, or a passing/failing check. The one P0 I implemented in this
pass is the reliability slice (§6); everything else is queued with a stated plan rather than
half-applied.

## 1. Method and evidence

| Evidence | How it was obtained |
|---|---|
| Production schema | PostgREST column probe against `zzytuzbemlfzuoclquua` using the public anon key that ships in the frontend bundle (`select=<col>&limit=1` → `200` exists / `42703` missing). No writes, no credentials used or exposed. |
| Backend behaviour | `Backend/test_*.py` suites (in-memory store, no network) — 7/7 exit 0 |
| Frontend | `tsc -b`, `eslint .`, `vitest run`, `npm run build` — all exit 0, 46/46 tests |
| Pipeline | `.github/workflows/deploy.yml` read in full |
| Docs | `dev.md`, `MARKETPLACE-GAPS.md`, `RATE-LIMITS.md` cross-checked against the routes |

## 2. P0 — production reliability

### P0-1 · Schema drift broke every user write — **root cause, now resolved**

**Symptom.** `POST /users/google` returned a 500 while the feed kept working.

**Cause.** Production `users` was missing `posting_flagged`, `flag_reason`,
`bad_listing_streak`. `_save_user` (`Backend/routes/users.py`) upserts
`user.model_dump()` — all 17 fields — so every write to `users` failed: signup, Google
sign-in, verification, resend, forgot/reset password. Reads kept working because
`_row_to_user` uses `.get()` defaults, which is exactly the observed split.

**Why nothing caught it.** `schema.sql` is one hand-applied idempotent file with no version
record, and the pipeline ran no checks. Production had received part of the change and nothing
could tell which part.

**Verified fixed.** All four columns now answer `200`: `posting_flagged`, `flag_reason`,
`bad_listing_streak`, `deleted_at`. Live `GET /users/u-ksaifeld` returns a clean profile.

**Mechanism now in place** (see §6): numbered migrations, `schema_check.py`, `GET /readyz`,
and a CI schema gate.

**Residual risk.** `_save_user` still writes the whole row, so *any* future column added to
`User` re-creates this outage class until the write is column-scoped. Recommended: write only
the intended columns and map PostgREST `42703` to a 503 with a clear message. Needs a product
decision on stale-session behaviour, so it is queued, not improvised.

### P0-2 · Unhandled exceptions looked like CORS failures — **fixed**

`main.py` had exactly one exception handler (`ImageRejected`). Anything else escaped to
Starlette's outermost error middleware, which returns a **bodyless 500 outside
CORSMiddleware**. Chrome therefore reported "blocked by CORS policy: No
'Access-Control-Allow-Origin' header" for what was a database error, and the traceback never
reached an operator. This cost hours of the outage.

Fixed in `Backend/observability.py` + `main.py`: every request now carries `X-Request-Id`
(client-supplied when well-formed, otherwise generated), unhandled exceptions return
`{"detail":"Internal server error","error":"<type>","request_id":"…"}` **with CORS headers**
(middleware ordering is load-bearing and commented as such), and one log line per request
records method, path, status, duration and request id. `LOG_JSON=1` switches logging to one
JSON object per line.

### P0-3 · Deploys ran with no checks — **fixed**

`.github/workflows/deploy.yml` fired the Vercel deploy hooks on every push to `main`/`dev`.
A broken build, a failing backend test, or an unapplied migration still shipped.

Now a `verify` job runs backend suites, the live schema check (when `SUPABASE_URL`/
`SUPABASE_KEY` repo secrets exist — skipped otherwise so forks still verify), `tsc -b`,
`eslint`, `vitest run`, and the production build; both deploy jobs `needs: verify`.

**Caveat:** if Vercel's native Git integration is also connected to this repo, it deploys
independently of this workflow. The hooks are the path this repo actually uses today.

### P0-4 · No in-app account deletion — **not implemented**

Only `DELETE /admin/users/{id}` exists. Apple 5.1.1(v) and Google Play both require users to
delete their own account in-app, and the 2.0 brief lists it under auth. Plan: `DELETE
/users/me` behind `require_user` with re-authentication (password or fresh Google token, the
pattern `set_password` already uses), reusing the cascade in `admin.delete_any_user` minus the
admin check; explicit list of what is deleted in the UI; regression tests.

### P0-5 · No user blocking, no report-a-user — **not implemented**

`POST /listings/{id}/report` exists; there is no user-level report and no block concept, so
`send_thread_message`/`open_thread`/`create_offer` never check whether two people should be
kept apart. This is both a trust gap (`MARKETPLACE-GAPS.md` §3.1/§3.2) and a store-review
requirement (Apple 1.2 needs reporting **and** blocking for UGC apps).

### P0-6 · Layering — **documented, deliberately not rewritten**

`routes/users.py` mixes public profile serialisation, authentication, moderation fields, and
(the admin module) destructive cascades over one table. The brief asks for separation; a
mechanical refactor of the auth surface is the riskiest change available right now, so it is
P1 work behind its own test pass rather than part of this slice.

## 3. P1 — auth, trust, experience, mobile

| # | Finding | File | Why it matters |
|---|---|---|---|
| 1 | Rate limits are in-process (`_hits` dict) | `ratelimit.py` | Resets on cold start and is per-instance on Vercel, so the 6-per-15-min login cap is a speed bump, not a control. `RATE-LIMITS.md` already says this. Needs a shared store. |
| 2 | No session revocation | `auth.py` | 30-day stateless HMAC token; changing a password does not invalidate other devices, and a lost phone cannot be signed out. `token_version` column + check in `require_user`. |
| 3 | EXIF/GPS not stripped | `storage.py` | Phone photos of dorm rooms publish coordinates plus device/timestamp metadata. `ImageOps.exif_transpose` + re-encode (the ~20-line fix already scoped in `MARKETPLACE-GAPS.md` §3.3). |
| 4 | Rating integrity | `routes/ratings.py`, schema | Unique `(rater, ratee)` index exists, but any signed-in user can rate any stranger once with no interaction. |
| 5 | Listing lifecycle | `routes/listings.py` | `wanted_requests` expires; `listings` never does, so the feed accumulates ghost inventory. |
| 6 | Feed index gap | `schema.sql` | Single-column `idx_listings_status` / `idx_listings_category`, no composite for the default feed (`status`, `category`, `created_at desc`). Will be the first slow query at scale. |
| 7 | Native Google sign-in | `frontend/src/features/login/AuthCard.tsx` | Uses GIS `ux_mode: "redirect"`; Google blocks OAuth in embedded WebViews (`disallowed_useragent`), so the Capacitor build cannot sign in yet despite the scheme/callback plumbing being complete. |
| 8 | Native API base URL | `frontend/src/lib/api.ts` | Defaults to `/api`, which resolves to `capacitor://localhost/api` on device. Native builds need an absolute `VITE_API_URL`. |
| 9 | Native push | `frontend/src/lib/push.ts` | Web Push (VAPID) is unavailable in native webviews; needs FCM + APNs via `@capacitor/push-notifications`. `android/app/build.gradle` already conditionally applies `google-services.json`. |
| 10 | Release mechanics | `android/app/build.gradle`, `ios/App/App/Info.plist` | No `signingConfigs`/keystore, `versionCode 1`, default Capacitor icons/splash on both platforms, no iOS photo/camera usage strings. |

## 4. Security review — what is actually sound

Verified, not assumed:

- **No sensitive fields in responses.** `_to_public` omits `password_hash`, verification and
  reset codes; live `GET /users/u-ksaifeld` confirms it (and returns `email: ""`).
- **Identity comes from the session, never the body.** `test_listing_seller_comes_from_the_session_not_the_body`,
  `test_patch_cannot_reassign_an_owner` pass.
- **IDs cannot be claimed.** `test_user_id_is_derived_from_the_email` passes.
- **Profile edits are an allow-list** with length caps (`UserUpdate`).
- **Photo hot-linking is refused** so moderation cannot be bypassed (400).
- **Admin access is server-side**: `require_admin` resolves the session id to an email and
  checks `ADMIN_EMAILS`; the browser's copy is cosmetic.
- **RLS enabled with zero policies** on all 14 tables; the anon key grants nothing. Confirmed
  live: `GET /rest/v1/users?select=id&limit=1` returns `200 []`.
- **`client_ip` uses the hop our proxy appended**, not the spoofable leftmost entry.
- **Service role key is backend-only**; the bundle contains only the anon key.

## 5. P2 — analytics and scale

No instrumentation today for registrations, listing views, offers started/accepted, or
completed transactions — every product decision is currently unmeasured. Cheapest start:
`listing_views (listing_id, viewer_id, created_at)` plus counters on existing tables, and a
`/admin` stats tab. Also unevaluated: response caching for the public feed, image delivery
(Supabase resize is Pro-only per `dev.md`), saved searches, notification preferences,
perceptual-hash duplicate detection.

## 6. Implemented in this pass

| Change | File |
|---|---|
| Request ids, JSON 500s with CORS headers, per-request logs, opt-in JSON log format | `Backend/observability.py` (new), `Backend/main.py` |
| `GET /healthz` (liveness) and `GET /readyz` (one cached schema probe, 503 while behind) | `Backend/main.py` |
| Schema validation against the live project, CLI + importable | `Backend/schema_check.py` (new) |
| Regression tests for ids, error shape, CORS-on-500, health | `Backend/test_observability.py` (new) |
| Numbered, idempotent deltas matching real production history | `Backend/migrations/{001,002,003}_*.sql`, `README.md` |
| CI gate: tests, schema check, typecheck, lint, tests, build before deploy | `.github/workflows/deploy.yml` |
| Test-only dependency (`httpx`, needed by `TestClient`) | `Backend/requirements-dev.txt` |

Verification results and the exact commands are in `IMPLEMENTATION-LOG.md`.

## 7. Recommended next phase (needs your go-ahead)

1. **P0-4 account deletion** + **P0-5 blocking/user reports** — the two store-review blockers
   and the two safety gaps students actually hit.
2. **P0-1 residual**: column-scoped `_save_user` and `42703` → 503 mapping.
3. **P1 shared-store rate limiting** and session revocation.
4. **Mobile readiness** (items 7–10 above) before any store submission.

Nothing was committed, pushed, deployed, or run against production data.
