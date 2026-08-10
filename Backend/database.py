import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

db = None
users = {}
listings = {}
threads = {}
messages = {}
ratings = {}
notifications = {}
reports = {}
offers = {}

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    if os.getenv("VERCEL"):
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY are not set. Add them to the "
            "Vercel backend project's Environment Variables."
        )
    from seed import seed_dev_store

    seed_dev_store(users, listings, ratings, threads, notifications)
