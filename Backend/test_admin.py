"""Checks for the admin panel: the email allow-list gate, and the destructive
endpoints (delete listing / request / account).

Run from Backend/:  python test_admin.py

Forces the in-memory store (like test_features.py) so nothing touches Supabase
or sends real email.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)
os.environ.pop("ADMIN_EMAILS", None)  # exercise the built-in allow-list

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from auth import create_session_token  # noqa: E402
from database import listings, users, wanted_requests  # noqa: E402
from models import User  # noqa: E402

client = TestClient(main.app)

ADMIN = "u-ksaifeld"
OTHER_ADMIN = "u-gmallang"
STUDENT = "u-anna"

for _id, _email, _name in (
    (ADMIN, "ksaifeld@charlotte.edu", "Kareem"),
    (OTHER_ADMIN, "gmallang@charlotte.edu", "Chand"),
):
    users[_id] = User(id=_id, email=_email, display_name=_name, email_verified=True)


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def test_admin_flag_is_reported_to_the_client():
    admin = client.get("/users/me", headers=_auth(ADMIN))
    assert admin.status_code == 200, admin.text
    assert admin.json()["is_admin"] is True

    student = client.get("/users/me", headers=_auth(STUDENT))
    assert student.status_code == 200, student.text
    assert student.json()["is_admin"] is False


def test_non_admins_are_locked_out():
    assert client.get("/admin/listings").status_code == 401

    for path in ("/admin/listings", "/admin/requests", "/admin/users"):
        assert client.get(path, headers=_auth(STUDENT)).status_code == 403, path

    assert (
        client.delete("/admin/listings/2", headers=_auth(STUDENT)).status_code == 403
    ), "a student must not be able to delete someone else's listing"
    assert client.delete("/admin/users/seller-1", headers=_auth(STUDENT)).status_code == 403


def test_admin_can_browse_everything():
    res = client.get("/admin/listings", params={"limit": 200}, headers=_auth(ADMIN))
    assert res.status_code == 200, res.text
    rows = res.json()
    assert rows, "the seeded store should have listings"
    sample = rows[0]
    assert sample["seller"] and sample["seller"]["display_name"]
    assert "report_count" in sample
    assert int(res.headers["x-total-count"]) == len(rows)

    # Admins see flagged rows that the public feed hides.
    flagged = client.get("/admin/listings", params={"status": "flagged"}, headers=_auth(ADMIN))
    assert flagged.status_code == 200
    public = client.get("/listings", params={"status": "flagged"})
    assert len(flagged.json()) >= len(public.json())

    accounts = client.get("/admin/users", headers=_auth(ADMIN))
    assert accounts.status_code == 200, accounts.text
    by_id = {row["id"]: row for row in accounts.json()}
    assert by_id[ADMIN]["is_admin"] is True
    assert by_id[STUDENT]["is_admin"] is False
    assert by_id[STUDENT]["listing_count"] >= 0


def test_admin_can_delete_any_listing():
    other_listing = next(
        l.id for l in listings.values() if l.seller_id == "seller-2"
    )

    res = client.delete(f"/admin/listings/{other_listing}", headers=_auth(ADMIN))
    assert res.status_code == 200, res.text
    assert res.json()["deleted"] == other_listing
    assert client.get(f"/listings/{other_listing}").status_code == 404

    assert client.delete("/admin/listings/nope", headers=_auth(ADMIN)).status_code == 404


def test_admin_can_delete_any_request():
    created = client.post(
        "/requests",
        json={
            "title": "Need a graphing calculator",
            "category": "electronics",
            "description": "TI-84 preferred, anything working is fine.",
            "budget_min": 20,
            "budget_max": 60,
        },
        headers=_auth(STUDENT),
    )
    assert created.status_code == 200, created.text
    request_id = created.json()["id"]

    listed = client.get("/admin/requests", params={"limit": 200}, headers=_auth(ADMIN))
    assert listed.status_code == 200, listed.text
    assert any(row["id"] == request_id for row in listed.json())

    res = client.delete(f"/admin/requests/{request_id}", headers=_auth(ADMIN))
    assert res.status_code == 200, res.text
    assert request_id not in wanted_requests
    assert client.get(f"/requests/{request_id}").status_code == 404

    assert client.delete("/admin/requests/nope", headers=_auth(ADMIN)).status_code == 404


def test_admins_cannot_delete_themselves():
    res = client.delete(f"/admin/users/{ADMIN}", headers=_auth(ADMIN))
    assert res.status_code == 400, res.text
    assert ADMIN in users


def test_admin_can_delete_an_account():
    victim = "seller-13"
    owned = [l.id for l in listings.values() if l.seller_id == victim]
    assert owned, "seed data should give this seller a listing"

    res = client.delete(f"/admin/users/{victim}", headers=_auth(ADMIN))
    assert res.status_code == 200, res.text
    assert victim not in users
    assert not [l for l in listings.values() if l.seller_id == victim], (
        "deleting an account must take its listings with it"
    )

    remaining = client.get("/admin/users", params={"limit": 200}, headers=_auth(ADMIN))
    assert victim not in {row["id"] for row in remaining.json()}

    assert client.delete("/admin/users/nope", headers=_auth(ADMIN)).status_code == 404


if __name__ == "__main__":
    test_admin_flag_is_reported_to_the_client()
    test_non_admins_are_locked_out()
    test_admin_can_browse_everything()
    test_admin_can_delete_any_listing()
    test_admin_can_delete_any_request()
    test_admins_cannot_delete_themselves()
    test_admin_can_delete_an_account()
    print("ok")
