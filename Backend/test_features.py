"""Smoke checks for the pagination + offer->deal-flow changes.

Run from Backend/:  python test_features.py

Forces the in-memory store (even though Backend/.env has Supabase/Resend creds)
so the checks never touch the network or send real email. load_dotenv only fills
env vars that aren't already set, so pre-setting them empty wins.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""  # keep email best-effort / no-op
os.environ.pop("VERCEL", None)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from auth import create_session_token  # noqa: E402

client = TestClient(main.app)


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def test_pagination():
    total = len(client.get("/listings", params={"limit": 200}).json())
    assert total > 0, "seed store should have listings"

    page1 = client.get("/listings", params={"limit": 5, "offset": 0})
    page2 = client.get("/listings", params={"limit": 5, "offset": 5})
    assert page1.status_code == 200 and page2.status_code == 200
    ids1 = [r["id"] for r in page1.json()]
    ids2 = [r["id"] for r in page2.json()]
    assert len(ids1) == 5 and len(ids2) == 5, "a full page returns exactly `limit` rows"
    assert not (set(ids1) & set(ids2)), "pages must not overlap"
    assert len(ids1) < total, "a small limit must not return the whole table"

    # Offset past the end is an empty page, not an error.
    assert client.get("/listings", params={"limit": 5, "offset": 1000}).json() == []

    # limit is capped, not unbounded.
    assert client.get("/listings", params={"limit": 9999}).status_code == 422


def test_offer_accept_opens_deal_thread():
    buyer = "u-anna"
    listing_id = "1"  # seeded, owned by seller-1

    r = client.post(
        f"/listings/{listing_id}/offers", json={"price": 10}, headers=_auth(buyer)
    )
    assert r.status_code == 200, r.text
    offer_id = r.json()["id"]

    r = client.post(f"/offers/{offer_id}/accept", headers=_auth("seller-1"))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"

    # Accepting marks the listing sold...
    assert client.get(f"/listings/{listing_id}").json()["status"] == "sold"

    # ...and opens a buyer/seller thread seeded with a message from the seller.
    threads = client.get(f"/users/{buyer}/threads", headers=_auth(buyer)).json()
    deal = [t for t in threads if t["listingId"] == listing_id]
    assert deal, "accepting an offer should open a buyer/seller thread"
    assert any(
        m["text"].startswith("Accepted your offer") for m in deal[0]["messages"]
    ), "deal thread should be seeded with the seller's message"


if __name__ == "__main__":
    test_pagination()
    test_offer_accept_opens_deal_thread()
    print("ok")
