# College Marketplace App (Frontend)

React + TypeScript + Vite frontend for NinerMarket, wired to the FastAPI backend.

## Running the app

The frontend proxies API calls to the backend through Vite. Start both:

1. Start the backend (from `Backend/`):

   ```
   pip install -r requirements.txt
   uvicorn main:app --port 8001
   ```

   Without `SUPABASE_URL`/`SUPABASE_KEY` set, the backend runs on an in-memory
   store pre-seeded with demo listings.

2. Start the frontend (from `frontend/`):

   ```
   npm i
   npm run dev
   ```

   Open http://localhost:5173. Requests to `/api/*` are proxied to
   http://localhost:8001/*. If the backend is unreachable, the app falls back
   to local demo data and shows a banner.

## API base URL

By default the app calls `/api` (handled by the Vite dev proxy). To point at a
different backend, set `VITE_API_URL` to the backend's base URL, e.g.
`VITE_API_URL=https://api.example.com npm run dev`.
