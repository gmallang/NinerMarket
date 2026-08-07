"""Seed a Supabase project with demo data.

Usage (from the Backend/ directory):
    python seed_supabase.py

Requires SUPABASE_URL and SUPABASE_KEY in Backend/.env (or environment).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from supabase import create_client

from seed import seed_supabase_store


def main() -> None:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_KEY in Backend/.env first.")
    db = create_client(supabase_url, supabase_key)
    seed_supabase_store(db)
    print("Supabase seeded with demo data.")


if __name__ == "__main__":
    main()
