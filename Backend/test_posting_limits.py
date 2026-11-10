"""Smoke checks for the posting caps (listings + "Looking For" requests).

Run from Backend/:  python test_posting_limits.py

Forces the in-memory store so the checks never touch the network, matching the
other test_*.py scripts. Each test uses its own account id because the caps are
counted per account.
"""

import os
from datetime import datetime, timedelta, timezone

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from auth import create_session_token  # noqa: E402
from database import listings as listing_store  # noqa: E402
from database import wanted_requests as request_store  # noqa: E402
from models import Listing  # noqa: E402
from routes import listings as listings_route  # noqa: E402
from routes import wanted_requests as requests_route  # noqa: E402

client = TestClient(main.app)


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def _listing(name: str) -> dict:
    return {
        "seller_id": "",  # ignored - the server always uses the session's user
        "name": name,
        "price": 5,
        "category": "other",
        "condition": "Used",
        "description": "Posting-limit test listing",
        "pickup_location": "Student Union",
    }


def _request(title: str) -> dict:
    return {
        "title": title,
        "category": "other",
        "description": "Posting-limit test request",
    }


def test_listing_hourly_cap():
    headers = _auth("u-postcap-listings")
    for i in range(listings_route.LISTING_HOURLY_LIMIT):
        r = client.post("/listings", json=_listing(f"Cap test {i}"), headers=headers)
        assert r.status_code == 200, r.text

    r = client.post("/listings", json=_listing("one too many"), headers=headers)
    assert r.status_code == 429, r.text
    assert "hourly limit" in r.json()["detail"].lower()

    # Counted per account, not globally: a different seller can still post.
    other = client.post(
        "/listings", json=_listing("different seller"), headers=_auth("u-postcap-other")
    )
    assert other.status_code == 200, other.text


def test_listing_daily_cap():
    """Pacing under the hourly cap must not allow posting forever."""
    user_id = "u-postcap-daily"
    two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
    for i in range(listings_route.LISTING_DAILY_LIMIT):
        listing_id = f"{user_id}-old-{i}"
        listing_store[listing_id] = Listing(
            id=listing_id,
            seller_id=user_id,
            name=f"Old listing {i}",
            price=5,
            category="other",
            condition="Used",
            description="Backdated for the daily-cap check",
            pickup_location="Student Union",
            created_at=two_hours_ago,
        )

    r = client.post("/listings", json=_listing("over the day"), headers=_auth(user_id))
    assert r.status_code == 429, r.text
    assert "today's limit" in r.json()["detail"].lower()


def test_request_hourly_cap():
    headers = _auth("u-postcap-requests")
    for i in range(requests_route.REQUEST_HOURLY_LIMIT):
        r = client.post("/requests", json=_request(f"Cap request {i}"), headers=headers)
        assert r.status_code == 200, r.text

    r = client.post("/requests", json=_request("one too many"), headers=headers)
    assert r.status_code == 429, r.text
    assert "hourly limit" in r.json()["detail"].lower()


def test_request_daily_cap():
    user_id = "u-postcap-req-daily"
    two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    for i in range(requests_route.REQUEST_DAILY_LIMIT):
        request_id = f"{user_id}-old-{i}"
        request_store[request_id] = {
            "id": request_id,
            "user_id": user_id,
            "title": f"Old request {i}",
            "category": "other",
            "description": "Backdated for the daily-cap check",
            "status": "active",
            "created_at": two_hours_ago,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
        }

    r = client.post("/requests", json=_request("over the day"), headers=_auth(user_id))
    assert r.status_code == 429, r.text
    assert "today's limit" in r.json()["detail"].lower()


if __name__ == "__main__":
    test_listing_hourly_cap()
    test_listing_daily_cap()
    test_request_hourly_cap()
    test_request_daily_cap()
    print("ok")
