"""Account deletion, blocking and reporting a person.

Run from Backend/:  python test_safety.py

Forces the in-memory store so nothing touches the network, matching the other
test_*.py scripts. Users are written straight into the store instead of going
through /users, because signup is rate-limited per IP and emails a code.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from auth import create_session_token, hash_password  # noqa: E402
from database import user_reports, users  # noqa: E402
from models import User  # noqa: E402

client = TestClient(main.app)
PASSWORD = "correct-horse-battery"


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def _user(user_id: str, *, with_password: bool = True) -> User:
    user = User(
        id=user_id,
        email=f"{user_id}@charlotte.edu",
        display_name=user_id.replace("u-", "").replace("-", " ").title(),
        email_verified=True,
        password_hash=hash_password(PASSWORD) if with_password else "",
    )
    users[user_id] = user
    return user


def _listing(seller_id: str, name: str) -> str:
    response = client.post(
        "/listings",
        json={
            "seller_id": seller_id,
            "name": name,
            "price": 10,
            "category": "other",
            "condition": "Used",
            "description": "Safety test listing",
            "pickup_location": "Student Union",
        },
        headers=_auth(seller_id),
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


# ── deleting your own account ──────────────────────────────────────────────


def test_delete_me_needs_the_password_then_hides_everything():
    _user("u-safety-del")
    listing_id = _listing("u-safety-del", "Delete me listing")

    wrong = client.request(
        "DELETE", "/users/me", json={"password": "not-it"}, headers=_auth("u-safety-del")
    )
    assert wrong.status_code == 401, wrong.text
    assert users["u-safety-del"].deleted_at is None
    assert client.get(f"/listings/{listing_id}").status_code == 200

    ok = client.request(
        "DELETE", "/users/me", json={"password": PASSWORD}, headers=_auth("u-safety-del")
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["listings_hidden"] == 1
    assert users["u-safety-del"].deleted_at is not None
    # The listing is hidden and the account's own session is dead.
    assert client.get(f"/listings/{listing_id}").status_code == 404
    assert client.get("/users/me", headers=_auth("u-safety-del")).status_code == 404

    again = client.request(
        "DELETE", "/users/me", json={"password": PASSWORD}, headers=_auth("u-safety-del")
    )
    assert again.status_code == 404


def test_google_only_account_confirms_its_email_instead_of_a_password():
    _user("u-safety-google", with_password=False)

    wrong = client.request(
        "DELETE",
        "/users/me",
        json={"confirm_email": "someone-else@charlotte.edu"},
        headers=_auth("u-safety-google"),
    )
    assert wrong.status_code == 400, wrong.text

    ok = client.request(
        "DELETE",
        "/users/me",
        json={"confirm_email": "U-Safety-Google@charlotte.edu"},
        headers=_auth("u-safety-google"),
    )
    assert ok.status_code == 200, ok.text


# ── blocking ───────────────────────────────────────────────────────────────


def test_block_is_mutual_for_offers_and_new_conversations():
    _user("u-safety-blocker")
    _user("u-safety-blocked")
    listing_id = _listing("u-safety-blocker", "Offer blocked listing")

    blocked = client.post("/users/u-safety-blocked/block", headers=_auth("u-safety-blocker"))
    assert blocked.status_code == 200, blocked.text

    offer = client.post(
        f"/listings/{listing_id}/offers",
        json={"price": 5},
        headers=_auth("u-safety-blocked"),
    )
    assert offer.status_code == 403, offer.text

    thread = client.post(
        "/users/u-safety-blocker/threads",
        json={"listing_id": listing_id, "other_user_id": "u-safety-blocked"},
        headers=_auth("u-safety-blocker"),
    )
    assert thread.status_code == 403, thread.text

    listed = client.get("/users/me/blocked", headers=_auth("u-safety-blocker"))
    assert [person["id"] for person in listed.json()] == ["u-safety-blocked"]

    assert client.delete(
        "/users/u-safety-blocked/block", headers=_auth("u-safety-blocker")
    ).status_code == 200
    allowed = client.post(
        f"/listings/{listing_id}/offers",
        json={"price": 5},
        headers=_auth("u-safety-blocked"),
    )
    assert allowed.status_code == 200, allowed.text


def test_you_cannot_block_yourself_and_a_blocked_list_is_per_account():
    _user("u-safety-solo")
    self_block = client.post("/users/u-safety-solo/block", headers=_auth("u-safety-solo"))
    assert self_block.status_code == 400
    assert client.get("/users/me/blocked", headers=_auth("u-safety-solo")).json() == []


# ── reporting a person ─────────────────────────────────────────────────────


def test_person_report_is_deduped_and_lands_in_the_admin_queue():
    _user("u-safety-reporter")
    _user("u-safety-target")

    first = client.post(
        "/users/u-safety-target/report",
        json={"reason": "Harassment", "details": "Kept messaging after I said stop"},
        headers=_auth("u-safety-reporter"),
    )
    assert first.status_code == 200, first.text

    duplicate = client.post(
        "/users/u-safety-target/report",
        json={"reason": "Harassment"},
        headers=_auth("u-safety-reporter"),
    )
    assert duplicate.status_code == 409, duplicate.text

    self_report = client.post(
        "/users/u-safety-reporter/report",
        json={"reason": "Other"},
        headers=_auth("u-safety-reporter"),
    )
    assert self_report.status_code == 400

    queue = client.get("/admin/user-reports", headers=_auth("u-ksaifeld"))
    assert queue.status_code == 200, queue.text
    row = next(item for item in queue.json() if item["reported_id"] == "u-safety-target")
    assert row["status"] == "open"
    assert row["reporter"]["display_name"]

    upheld = client.post(
        f"/admin/user-reports/{row['id']}/uphold", headers=_auth("u-ksaifeld")
    )
    assert upheld.status_code == 200, upheld.text
    assert users["u-safety-target"].deleted_at is not None

    resolved = client.get(
        "/admin/user-reports?status=upheld", headers=_auth("u-ksaifeld")
    )
    assert any(item["id"] == row["id"] for item in resolved.json())


def test_person_report_requires_a_target_and_login():
    _user("u-safety-noauth")
    anonymous = client.post(
        "/users/u-safety-noauth/report", json={"reason": "Other"}
    )
    assert anonymous.status_code == 401

    missing = client.post(
        "/users/u-nobody-here/report",
        json={"reason": "Other"},
        headers=_auth("u-safety-noauth"),
    )
    assert missing.status_code == 404


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all safety checks passed")
