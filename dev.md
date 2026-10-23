# NinerMarket Developer Guide

Setup, testing, and deployment for NinerMarket.

## Running locally

The backend falls back to a seeded in-memory store when `SUPABASE_URL`/`SUPABASE_KEY`
are absent (`Backend/database.py`), so no Supabase account is needed for local dev.

```bash
# Backend (port 8001)
cd Backend
python -m venv venv
venv\Scripts\activate          # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --port 8001

# Frontend
cd Frontend
npm install
npm run dev                    # http://localhost:5173
```

The Vite proxy (`Frontend/vite.config.ts`) targets `http://localhost:8001`. Port 8000
is often occupied by an unrelated project; don't kill it.

Seeded login: `anna@charlotte.edu` / `ninermarket-demo` (all seed users share it).

## Verification

```bash
cd Frontend
npx tsc -b          # typecheck
npx eslint .        # lint
npx vitest run      # tests
npm run build       # production build
```

## Images

Photos are uploaded via `POST /photos`, stored in Supabase Storage, and each upload
generates a 400px JPEG thumbnail (`photos_small`) with Pillow. Cards/rows render the
thumbnail; the detail view renders the original.

Supabase's `/render/image/` resize endpoint is a **Pro-plan feature** and is
deliberately not used (it fails on the free plan). To backfill `photos_small` for
older listings:

```bash
python Backend/migrate_photos.py
```

## Architecture / gotchas

- **Service role vs anon key.** The backend uses the `service_role` key (`SUPABASE_KEY`)
  for DB writes (no RLS). The anon key (`SUPABASE_ANON_KEY`) is used only for Realtime
  broadcasts; broadcasting with the service_role key returns 202 but is never delivered.
  Never expose the service role key to the frontend.
- **Sessions** are signed with `SESSION_SECRET`; the frontend sends `Authorization: Bearer …`.
  Set a stable value in prod or sessions won't survive redeploys.
- **Rate limiting:** login is limited (6 per email per 15 min, in-memory). Repeated failed
  logins return HTTP 429. Restart the backend to clear it.
- **Local dev is `.env`-less:** don't expect Supabase behavior locally unless you add `Backend/.env`.

## Supabase schema

Apply `Backend/schema.sql` in the Supabase SQL Editor. It is idempotent. It creates/updates
`users` (incl. password-reset columns), `listings`, `saved_listings`, `notifications`,
`push_subscriptions`, `offers`, and the rest, required or the corresponding features 500 in prod.

## Environment variables

Backend (set in the host's project settings, then redeploy):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | service_role key |
| `SUPABASE_ANON_KEY` | anon key (Realtime broadcasts only) |
| `SESSION_SECRET` | signs session tokens |
| `ALLOWED_ORIGINS` | comma-separated allowed frontend origins |
| `FRONTEND_URL` | deployed frontend origin |
| `RESEND_API_KEY` | transactional email |
| `GOOGLE_CLIENT_ID` | Google sign-in |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | web push |

Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Generate a VAPID keypair with `npx web-push generate-vapid-keys`.

## Pre-deploy checklist

- [ ] `tsc -b`, `eslint`, `vitest run`, `npm run build` all pass.
- [ ] `Backend/schema.sql` applied to Supabase.
- [ ] All backend env vars set; frontend `VITE_*` set for the deployed build.

## Key files

- Backend: `routes/{users,listings,saved,push,notifications,offers,photos,messaging,ratings}.py`,
  `push.py`, `broadcast.py`, `database.py`, `schema.sql`, `main.py`
- Frontend: `src/lib/{store,api,push,realtime,image}.ts`, `src/app/AppLayout.tsx`,
  `src/features/listings/`, `src/features/login/`
