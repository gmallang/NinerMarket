"""Checks for the Looking For feature: request CRUD, ownership, responding and
listing→request matching.

Run from Backend/:  python test_requests.py

Forces the in-memory store (like test_features.py) so nothing touches Supabase
or sends real email.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)

from datetime import datetime, timedelta, timezone  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from auth import create_session_token  # noqa: E402
from database import notifications, wanted_requests  # noqa: E402

client = TestClient(main.app)

REQUESTER = "u-anna"
OTHER = "seller-1"


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def _new_request(**overrides) -> dict:
    payload = {
        "title": "Mini Fridge for my dorm",
        "category": "furniture",
        "description": "Need a small fridge before move-in, anything working is fine.",
        "budget_min": 40,
        "budget_max": 60,
        "preferred_location": "UNC Charlotte Campus",
    }
    payload.update(overrides)
    r = client.post("/requests", json=payload, headers=_auth(REQUESTER))
    assert r.status_code == 200, r.text
    return r.json()


def test_create_and_feed():
    created = _new_request()
    assert created["status"] == "active"
    assert created["requester"]["display_name"]
    assert created["response_count"] == 0

    feed = client.get("/requests", params={"limit": 50})
    assert feed.status_code == 200
    ids = {r["id"] for r in feed.json()}
    assert created["id"] in ids, "a new active request should appear in the feed"
    assert int(feed.headers["x-total-count"]) >= 1

    single = client.get(f"/requests/{created['id']}")
    assert single.status_code == 200
    assert single.json()["title"] == created["title"]

    # Sequence matters: expire this request before later tests so the feed
    # assertions below never depend on it.
    client.delete(f"/requests/{created['id']}", headers=_auth(REQUESTER))


def test_validation():
    assert client.post("/requests", json={"title": "x"}).status_code == 401

    bad_budget = client.post(
        "/requests",
        json={
            "title": "Desk lamp",
            "category": "furniture",
            "description": "Anything bright",
            "budget_min": 50,
            "budget_max": 10,
        },
        headers=_auth(REQUESTER),
    )
    assert bad_budget.status_code == 422

    bad_category = client.post(
        "/requests",
        json={"title": "Desk lamp", "category": "spaceships", "description": "hi"},
        headers=_auth(REQUESTER),
    )
    assert bad_category.status_code == 422

    prohibited = client.post(
        "/requests",
        json={"title": "Looking for a taser", "category": "other", "description": "self defense"},
        headers=_auth(REQUESTER),
    )
    assert prohibited.status_code == 422, "prohibited items must be rejected up front"

    past = client.post(
        "/requests",
        json={
            "title": "Old request",
            "category": "other",
            "description": "expired on purpose",
            "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        },
        headers=_auth(REQUESTER),
    )
    assert past.status_code == 422


def test_filters():
    # A deliberately unique token: the dev seed ships demo requests, so exact
    # "only this row" assertions would depend on seed contents.
    match = _new_request(
        title="Ancient philosophy reader 9931", category="textbooks", description="Used is fine"
    )
    _new_request(title="Scooter", category="bikes", description="Anything with wheels")

    by_category = client.get("/requests", params={"category": "textbooks", "limit": 50}).json()
    assert match["id"] in {r["id"] for r in by_category}
    assert all(r["category"] == "textbooks" for r in by_category), (
        "the category filter must not leak other categories"
    )

    by_query = client.get("/requests", params={"q": "9931", "limit": 50}).json()
    assert [r["id"] for r in by_query] == [match["id"]]

    client.delete(f"/requests/{match['id']}", headers=_auth(REQUESTER))


def test_ownership_and_status():
    req = _new_request(title="Dorm chair", category="furniture", description="Any color")

    assert client.patch(f"/requests/{req['id']}", json={"title": "Nope"}).status_code == 401
    assert (
        client.patch(f"/requests/{req['id']}", json={"title": "Nope"}, headers=_auth(OTHER)).status_code
        == 403
    )
    assert client.delete(f"/requests/{req['id']}", headers=_auth(OTHER)).status_code == 403

    # A budget range that inverts the stored minimum is rejected.
    inverted = client.patch(
        f"/requests/{req['id']}", json={"budget_max": 25}, headers=_auth(REQUESTER)
    )
    assert inverted.status_code == 422

    edited = client.patch(
        f"/requests/{req['id']}",
        json={"title": "Dorm chair (wooden)", "budget_max": 80},
        headers=_auth(REQUESTER),
    )
    assert edited.status_code == 200
    assert edited.json()["title"] == "Dorm chair (wooden)"

    fulfilled = client.patch(
        f"/requests/{req['id']}", json={"status": "fulfilled"}, headers=_auth(REQUESTER)
    )
    assert fulfilled.json()["status"] == "fulfilled"
    assert req["id"] not in {r["id"] for r in client.get("/requests").json()}

    mine = client.get(f"/users/{REQUESTER}/requests", headers=_auth(REQUESTER)).json()
    assert req["id"] in {r["id"] for r in mine}
    assert (
        client.get(f"/users/{REQUESTER}/requests", headers=_auth(OTHER)).status_code == 403
    )

    reopened = client.patch(
        f"/requests/{req['id']}", json={"status": "active"}, headers=_auth(REQUESTER)
    )
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "active"

    deleted = client.delete(f"/requests/{req['id']}", headers=_auth(REQUESTER))
    assert deleted.status_code == 200
    assert client.get(f"/requests/{req['id']}").status_code == 404


def test_expired_requests_leave_the_feed():
    req = _new_request(title="Snowboard", category="other", description="for a trip")
    # Age it past its expiration without waiting a month.
    wanted_requests[req["id"]]["expires_at"] = (
        datetime.now(timezone.utc) - timedelta(hours=1)
    ).isoformat()

    assert req["id"] not in {r["id"] for r in client.get("/requests").json()}
    assert client.get(f"/requests/{req['id']}").json()["status"] == "expired"

    mine = client.get(
        f"/users/{REQUESTER}/requests", params={"status": "expired"}, headers=_auth(REQUESTER)
    ).json()
    assert req["id"] in {r["id"] for r in mine}

    # Reopening gives it a fresh window instead of flipping straight back.
    reopened = client.patch(
        f"/requests/{req['id']}", json={"status": "active"}, headers=_auth(REQUESTER)
    ).json()
    assert reopened["status"] == "active"
    assert req["id"] in {r["id"] for r in client.get("/requests", params={"limit": 50}).json()}

    client.delete(f"/requests/{req['id']}", headers=_auth(REQUESTER))


def test_respond_and_request_thread():
    req = _new_request(title="Calculus textbook", category="textbooks", description="8th edition")

    own = client.post(f"/requests/{req['id']}/respond", headers=_auth(REQUESTER))
    assert own.status_code == 400, "you can't respond to your own request"

    first = client.post(f"/requests/{req['id']}/respond", headers=_auth(OTHER))
    assert first.status_code == 200, first.text
    second = client.post(f"/requests/{req['id']}/respond", headers=_auth(OTHER))
    assert second.json()["id"] == first.json()["id"], "responding twice reuses the record"

    assert any(
        "responded to your request" in n["text"] for n in notifications.get(REQUESTER, [])
    ), "the requester should be notified"
    assert client.get(f"/requests/{req['id']}").json()["response_count"] == 1

    # The conversation lives in the existing messaging system, keyed by the
    # request instead of a listing.
    thread = client.post(
        f"/users/{OTHER}/threads",
        json={"listing_id": f"request:{req['id']}", "other_user_id": REQUESTER},
        headers=_auth(OTHER),
    )
    assert thread.status_code == 200, thread.text
    thread_id = thread.json()["id"]

    sent = client.post(
        f"/users/{OTHER}/threads/{thread_id}/messages",
        json={"text": "I have the 8th edition, barely used."},
        headers=_auth(OTHER),
    )
    assert sent.status_code == 200, sent.text

    # Both sides can see and reply to it.
    requester_threads = client.get(f"/users/{REQUESTER}/threads", headers=_auth(REQUESTER)).json()
    assert any(t["id"] == thread_id for t in requester_threads)

    reply = client.post(
        f"/users/{REQUESTER}/threads/{thread_id}/messages",
        json={"text": "Great — how much?"},
        headers=_auth(REQUESTER),
    )
    assert reply.status_code == 200, reply.text

    client.delete(f"/requests/{req['id']}", headers=_auth(REQUESTER))


def test_listing_matching_notifies_once():
    req = _new_request(
        title="Looking for a mini fridge",
        category="furniture",
        description="Small fridge for my dorm room, working condition.",
    )
    before = len(notifications.get(REQUESTER, []))

    listing = client.post(
        "/listings",
        json={
            "seller_id": OTHER,
            "name": "Galanz mini fridge — dorm size",
            "price": 55,
            "category": "furniture",
            "condition": "Good",
            "description": "Compact fridge, works perfectly, dorm room sized.",
            "pickup_location": "Res Life Complex",
        },
        headers=_auth(OTHER),
    )
    assert listing.status_code == 200, listing.text
    listing_id = listing.json()["id"]

    matches = [n for n in notifications.get(REQUESTER, []) if n.get("listing_id") == listing_id]
    assert len(matches) == 1, "a matching listing should notify the requester exactly once"
    assert len(notifications.get(REQUESTER, [])) == before + 1

    # A second unrelated listing in the same category must not spam them.
    unrelated = client.post(
        "/listings",
        json={
            "seller_id": OTHER,
            "name": "Wooden desk lamp",
            "price": 12,
            "category": "furniture",
            "condition": "Good",
            "description": "Warm light, adjustable arm.",
            "pickup_location": "Main Quad",
        },
        headers=_auth(OTHER),
    )
    assert unrelated.status_code == 200
    assert not [
        n
        for n in notifications.get(REQUESTER, [])
        if n.get("listing_id") == unrelated.json()["id"]
    ], "vague category overlap alone must not notify"

    client.delete(f"/requests/{req['id']}", headers=_auth(REQUESTER))


if __name__ == "__main__":
    test_validation()
    test_create_and_feed()
    test_filters()
    test_ownership_and_status()
    test_expired_requests_leave_the_feed()
    test_respond_and_request_thread()
    test_listing_matching_notifies_once()
    print("ok")
