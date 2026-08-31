# CLAUDE.md

Operational runbook for NinerMarket — a campus marketplace.
**Frontend:** React 18 + TypeScript + Vite + Zustand, in `Frontend/`.
**Backend:** FastAPI (Python), in `Backend/` — runs on a local **in-memory store** if no Supabase env is set, otherwise uses Supabase via PostgREST.

This file captures what has been built, what is still **outstanding**, and the exact checks required before/after shipping to production (Vercel + Supabase).

---

## 1. Running locally

The backend falls back to a seeded in-memory store when `SUPABASE_URL`/`SUPABASE_KEY` are absent (see `Backend/database.py:23`). No Supabase account is needed for local dev.

```bash
# Backend  (port 8001 by default in this repo’s vite proxy)
cd Backend
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8001

# Frontend (Vite dev server)
cd Frontend
npm run dev
```

**Important:** the vite proxy in `Frontend/vite.config.ts:14` points at `http://localhost:8001`.
Port 8000 is often occupied by an unrelated project (`~/Downloads/SearchTern/backend`) — do **not** kill it. If you switch `main:app` back to port 8000, update the proxy target to match.

Test login (seeded in-memory): `anna@charlotte.edu` / `ninermarket-demo`.
All seed users share the password `ninermarket-demo`.

---

## 2. Verification commands (Frontend)

Run all of these after any frontend change:

```bash
cd Frontend
npx tsc -b                                   # typecheck
npx eslint .                                 # lint (no errors expected)
npx vitest run                               # 36 tests, all pass
npm run build                                # production build must succeed
```

Run these and the dev servers (above) before every hand-off.

---

## 3. Features recently added / changed

### 3.1 Forgot / reset password  ✅ implemented (backend + frontend)
- Backend: `POST /users/forgot-password`, `POST /users/reset-password` (`Backend/routes/users.py`), request schemas in `Backend/models.py`, `send_verification_email` now takes a subject/intro.
- Frontend: multi-step modal in `Frontend/src/features/login/LoginPage.tsx`.
- Requires **schema columns** on `lots`… see §5 (migration).

### 3.2 Saved listings — server-side  ✅ implemented
- Backend: `Backend/routes/saved.py`, `saved_listings` table, `saved` dict in the in-memory store; router registered in `main.py:27`.
- Frontend: optimistic toggle with rollback in `store.ts`, legacy localStorage folded in on first sign-in, cleared on logout.
- Requires the **`saved_listings` table** in Supabase — see §5 (migration).

### 3.3 Search — server-side  ✅ implemented
- `GET /listings?q=` does substring matching on `name`/`description`/`pickup_location`. The Fuse.js bug (char-splitting) was fixed. `fuse.js` was **removed** from `package.json`.
- Frontend `HomePage` refetches silently when `?q=` changes; other filters (category/price/location/condition) remain client-side.

### 3.4 Listing image UX — ✅ done (recently)
- **`ProgressiveImage`** component (`Frontend/src/lib/…/ProgressiveImage.tsx` + `.module.css`): shimmer placeholder + fade-in, applied to `ListingCard` and `ListingRow`.
- **Detail gallery** (`ListingDetail.tsx`): Facebook Marketplace-style prev/next side arrows, bottom progress dots, bottom-right counter pill, thumbnail strip; active photo served as a responsive downscale (`listingImageUrl(..., 1200)`) for a fast first paint.
- Grid/list now use responsive `srcset` + shimmer instead of blank boxes.
- **Thumbnails** are now their own distinct box below the main image (own background/border/padding) — see `detail.module.css`.
- Note: the image is sized to **fill the gallery height** (`detailMain { flex: 1 }`) with `object-fit: contain`. Do not reintroduce a fixed 4:3 stage — it made the image too small, and the previous "centered 4:3" caused bottom white space. Small letterbox bands for non-matching aspect ratios are expected and acceptable.

### 3.5 Web Push — ⚠️ CODE OK, PROD ENV IS THE GAP (see §5 and §6)
- Backend: `Backend/routes/push.py` (vapid-public-key + subscribe/unsubscribe), `Backend/push.py` (`send_push`, best-effort), `broadcast.py` (Supabase Realtime broadcasts).
- Frontend: `Frontend/src/lib/push.ts` (subscribe), opt-in prompt in `AppLayout.tsx`, `store.ts` push actions.
- `enablePushNotifications` now returns a discriminated result (`ok | denied | nokey | failed`) and surfaces a clear "Push isn't configured on the server yet" message when the VAPID public key is missing.

---

## 4. Architecture / gotchas

- **Service role vs anon key:** the backend uses the `service_role` key (`SUPABASE_KEY`) for DB writes (no RLS). The **anon** key (`SUPABASE_ANON_KEY`) is used ONLY for Realtime broadcasts — broadcasting with the service_role key returns 202 but is never delivered. Never expose the service role key to the frontend.
- **Session auth:** session tokens signed with `SESSION_SECRET`. Frontend sends `Authorization: Bearer …`. Include `SESSION_SECRET` in prod or sessions won't survive restarts / redeploys.
- **Rate limiting:** login is limited (6 per email per 15 min, in-memory). During debugging, repeated failed logins will produce **HTTP 429 "Too many attempts"** — restart the backend to clear it. This is in-memory only and resets on cold start.
- **Frontend runs on `.env`-less in-memory locally:** don't expect Supabase behavior locally unless you add a `Backend/.env`.

---

## 5. PENDING — Supabase schema migration (MUST be applied to live Supabase)

Apply `Backend/schema.sql` in Supabase Dashboard → SQL Editor. It is idempotent (`create table if not exists`, `add column if not exists`). Specifically added recently:

- `users` columns: `password_reset_code`, `password_reset_expires`
- `saved_listings` table (user_id, listing_id, created_at; composite PK)

These options MUST be present or the new features (forgot-password, saved listings) will 500 in prod:
- `notifications`, `saved_listings`, `push_subscriptions`, `offers`, etc. (covered by schema.sql).

---

## 6. PRODUCTION ENVIRONMENT VARIABLES (Vercel — verify each)

Every project env var must be a Supabase-accessible setting. Check Vercel → Project → Settings → Environment Variables, then **redeploy** after any change.

Required:
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | **service_role** key |
| `SUPABASE_ANON_KEY` | anon key (Realtime broadcasts only) |
| `SESSION_SECRET` | signs session tokens (stable value) |
| `ALLOWED_ORIGINS` | comma-separated frontend origins (e.g. `https://…vercel.app`) |
| `FRONTEND_URL` | deployed frontend origin |

**Push (currently the known prod gap):**
- `VAPID_PUBLIC_KEY`  ← **probably missing; this is why "Notifications not available yet"**
- `VAPID_PRIVATE_KEY` ← **probably missing**
- `VAPID_SUBJECT` (optional, defaults to `mailto:support@ninermarket.com`)

Generate a VAPID keypair once with either:

```bash
# Backend venv (py-vapid is a dependency of pywebpush)
source Backend/venv/bin/activate
python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key.urlsafe); print(v.private_key.urlsafe)"

# OR
npx web-push generate-vapid-keys
```

Both keys must be set AND the frontend must be able to reach `/push/vapid-public-key`, otherwise the app shows "Not available yet — check back soon." (now "Push isn't configured on the server yet").

---

## 7. PRODUCTION CHECKS before/after deploy

### Before deploy
- [ ] Run the §2 verification suite (tsc, eslint, vitest, build).
- [ ] Confirm all §5 migrations have been applied to Supabase.
- [ ] Confirm ALL §6 env vars are set in Vercel (backend).
- [ ] Confirm frontend `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set for the deployed frontend build (used by `realtime.ts` for live recall).

### After deploy — functional smoke tests (through prod URL)
- [ ] Load homepage; listings render with images (ProgressiveImage shimmer then fade).
- [ ] Open a multi-photo listing → prev/next arrows, bottom dots, counter, thumbnail strip visible; arrows disabled at ends.
- [ ] Sign in (real account) → logout/login works; saved list persists across sessions.
- [ ] Turn on a saved item → toggle ✓ off; reload → state persists (server-backed).
- [ ] Trigger forgot-password → email received → reset works with the code.
- [ ] Search a keyword via the search box → filtered results (server-side `q`).
- [ ] Make an offer or send a message → **OS push notification** appears (tab closed). If it doesn’t, check `VAPID_*` env and that `/push/vapid-public-key` returns a non-empty key.
- [ ] Bell badge updates live when another action triggers a notification (relies on Supabase Realtime `inbox:{userId}` broadcast via anon key).

---

## 8. References (key files)

- Backend: `Backend/routes/{users,listings,saved,push,notifications}.py`, `Backend/push.py`, `Backend/broadcast.py`, `Backend/database.py`, `Backend/schema.sql`, `Backend/main.py`
- Frontend: `Frontend/src/lib/{store,api,push,realtime,image}.ts`, `Frontend/src/app/AppLayout.tsx`, `Frontend/src/features/listings/{ListingDetail,ListingCard,ListingRow,ProgressiveImage}.tsx`, `Frontend/src/features/login/LoginPage.tsx`, `Frontend/vite.config.ts`
