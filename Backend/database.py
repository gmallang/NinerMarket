import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

db = None
users = {}
listings = {}
threads = {}
messages = {}
ratings = {}

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
