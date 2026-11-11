"""Checks for the admin panel: the email allow-list gate, and the destructive
endpoints (delete listing / request / rating / account).

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
from database import listings, ratings, users, wanted_requests  # noqa: E402
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

    for path in (
        "/admin/listings",
        "/admin/requests",
        "/admin/reports",
        "/admin/ratings",
        "/admin/users",
        "/admin/audit",
    ):
        assert client.get(path, headers=_auth(STUDENT)).status_code == 403, path

    assert (
        client.delete("/admin/listings/2", headers=_auth(STUDENT)).status_code == 403
    ), "a student must not be able to delete someone else's listing"
    assert client.delete("/admin/ratings/nope", headers=_auth(STUDENT)).status_code == 403
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


def test_admin_can_delete_a_rating_and_recompute_the_average():
    rater = "u-admin-rating-rater"
    target = "u-admin-rating-target"
    users[rater] = User(
        id=rater,
        email="admin-rating-rater@charlotte.edu",
        display_name="Rating Rater",
        email_verified=True,
    )
    users[target] = User(
        id=target,
        email="admin-rating-target@charlotte.edu",
        display_name="Rating Target",
        email_verified=True,
    )

    created = client.post(
        "/ratings",
        json={
            "rater_id": rater,
            "ratee_id": target,
            "listing_id": "",
            "stars": 5,
            "comment": "Great transaction",
        },
        headers=_auth(rater),
    )
    assert created.status_code == 200, created.text
    rating_id = created.json()["id"]
    assert users[target].rating_count == 1
    assert users[target].rating_avg == 5

    listed = client.get("/admin/ratings", params={"limit": 200}, headers=_auth(ADMIN))
    assert listed.status_code == 200, listed.text
    row = next(item for item in listed.json() if item["id"] == rating_id)
    assert row["rater"]["display_name"] == "Rating Rater"
    assert row["ratee"]["display_name"] == "Rating Target"

    assert client.delete(f"/admin/ratings/{rating_id}", headers=_auth(STUDENT)).status_code == 403

    removed = client.delete(f"/admin/ratings/{rating_id}", headers=_auth(ADMIN))
    assert removed.status_code == 200, removed.text
    assert rating_id not in ratings
    assert users[target].rating_count == 0
    assert users[target].rating_avg == 0

    assert client.delete(f"/admin/ratings/{rating_id}", headers=_auth(ADMIN)).status_code == 404


def test_admins_cannot_delete_themselves():
    res = client.delete(f"/admin/users/{ADMIN}", headers=_auth(ADMIN))
    assert res.status_code == 400, res.text
    assert ADMIN in users


def test_admin_can_close_and_restore_an_account():
    victim = "seller-13"
    owned = {l.id for l in listings.values() if l.seller_id == victim}
    assert owned, "seed data should give this seller a listing"

    res = client.delete(f"/admin/users/{victim}", headers=_auth(ADMIN))
    assert res.status_code == 200, res.text
    assert res.json()["listings_hidden"] == len(owned)

    # Soft delete: every row is kept, just hidden.
    assert victim in users
    assert users[victim].deleted_at is not None
    public_ids = {row["id"] for row in client.get("/listings", params={"limit": 200}).json()}
    assert not (owned & public_ids), "a closed account's listings must leave the public feed"

    # As far as the rest of the app is concerned, the account is gone.
    assert client.get(f"/users/{victim}").status_code == 404
    active = client.get("/admin/users", params={"limit": 200}, headers=_auth(ADMIN)).json()
    assert victim not in {row["id"] for row in active}

    closed = client.get(
        "/admin/users", params={"deleted": "true", "limit": 200}, headers=_auth(ADMIN)
    ).json()
    closed_row = next(row for row in closed if row["id"] == victim)
    assert closed_row["deleted_at"]

    assert client.delete(f"/admin/users/{victim}", headers=_auth(ADMIN)).status_code == 400
    assert client.delete("/admin/users/nope", headers=_auth(ADMIN)).status_code == 404

    assert (
        client.post(f"/admin/users/{victim}/restore", headers=_auth(STUDENT)).status_code
        == 403
    )

    restored = client.post(f"/admin/users/{victim}/restore", headers=_auth(ADMIN))
    assert restored.status_code == 200, restored.text
    assert users[victim].deleted_at is None
    assert client.get(f"/users/{victim}").status_code == 200
    admin_ids = {
        row["id"]
        for row in client.get(
            "/admin/listings", params={"limit": 200}, headers=_auth(ADMIN)
        ).json()
    }
    assert owned <= admin_ids, "restoring the account must bring its listings back"
    assert client.post(f"/admin/users/{victim}/restore", headers=_auth(ADMIN)).status_code == 400


def test_admin_can_flag_an_account_so_its_posts_need_approval():
    seller = "u-approval-test"
    users[seller] = User(
        id=seller,
        email="approval-test@charlotte.edu",
        display_name="Approval Test",
        email_verified=True,
    )

    flagged = client.patch(
        f"/admin/users/{seller}/flag",
        json={"flagged": True, "reason": "Repeated spam"},
        headers=_auth(ADMIN),
    )
    assert flagged.status_code == 200, flagged.text
    assert flagged.json()["posting_flagged"] is True
    assert flagged.json()["flag_reason"] == "Repeated spam"

    created = client.post(
        "/listings",
        json={
            "seller_id": seller,
            "name": "Desk lamp",
            "price": 15,
            "category": "furniture",
            "condition": "Good",
            "description": "Warm light, works fine.",
            "pickup_location": "Belk Hall",
        },
        headers=_auth(seller),
    )
    assert created.status_code == 200, created.text
    listing = created.json()
    assert listing["status"] == "pending"

    public_ids = {row["id"] for row in client.get("/listings", params={"limit": 200}).json()}
    assert listing["id"] not in public_ids, "pending posts must stay out of the public feed"

    approved = client.post(f"/admin/listings/{listing['id']}/approve", headers=_auth(ADMIN))
    assert approved.status_code == 200, approved.text
    assert client.get(f"/listings/{listing['id']}").json()["status"] == "active"

    assert (
        client.post(f"/admin/listings/{listing['id']}/approve", headers=_auth(ADMIN)).status_code
        == 400
    ), "an already-active listing doesn't need a second approval"

    cleared = client.patch(
        f"/admin/users/{seller}/flag", json={"flagged": False}, headers=_auth(ADMIN)
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["posting_flagged"] is False
    assert users[seller].bad_listing_streak == 0

    normal = client.post(
        "/listings",
        json={
            "seller_id": seller,
            "name": "Notebook set",
            "price": 8,
            "category": "school-supplies",
            "condition": "Like New",
            "description": "Three unused notebooks.",
            "pickup_location": "Belk Hall",
        },
        headers=_auth(seller),
    )
    assert normal.json()["status"] == "active"

    assert (
        client.patch(
            f"/admin/users/{ADMIN}/flag", json={"flagged": True}, headers=_auth(ADMIN)
        ).status_code
        == 400
    ), "admins must not be able to flag their own account"


def test_three_bad_listings_in_a_row_flag_the_seller():
    seller = "u-streak-test"
    users[seller] = User(
        id=seller,
        email="streak-test@charlotte.edu",
        display_name="Streak Test",
        email_verified=True,
    )

    for index in range(3):
        created = client.post(
            "/listings",
            json={
                "seller_id": seller,
                "name": f"Vodka bottle {index}",
                "price": 20,
                "category": "other",
                "condition": "New",
                "description": "Sealed bottle, never opened.",
                "pickup_location": "Belk Hall",
            },
            headers=_auth(seller),
        )
        assert created.status_code == 200, created.text
        assert created.json()["status"] == "flagged"

    assert users[seller].posting_flagged is True
    assert users[seller].bad_listing_streak == 3
    assert "Three listings" in users[seller].flag_reason

    clean = client.post(
        "/listings",
        json={
            "seller_id": seller,
            "name": "Desk chair",
            "price": 25,
            "category": "furniture",
            "condition": "Good",
            "description": "Comfortable office chair.",
            "pickup_location": "Belk Hall",
        },
        headers=_auth(seller),
    )
    assert clean.status_code == 200, clean.text
    assert clean.json()["status"] == "pending", (
        "a flagged seller's next post must wait for admin approval"
    )


def test_report_queue_can_dismiss_reports_and_remove_a_listing():
    seller = "u-report-queue-seller"
    users[seller] = User(
        id=seller,
        email="report-queue-seller@charlotte.edu",
        display_name="Report Seller",
        email_verified=True,
    )

    def make_listing(name: str) -> str:
        created = client.post(
            "/listings",
            json={
                "seller_id": seller,
                "name": name,
                "price": 40,
                "category": "electronics",
                "condition": "Good",
                "description": "Works fine, selling because I upgraded.",
                "pickup_location": "Belk Hall",
            },
            headers=_auth(seller),
        )
        assert created.status_code == 200, created.text
        assert created.json()["status"] == "active"
        return created.json()["id"]

    reporters = []
    for index in range(3):
        reporter = f"u-report-queue-reporter-{index}"
        users[reporter] = User(
            id=reporter,
            email=f"report-queue-{index}@charlotte.edu",
            display_name=f"Reporter {index}",
            email_verified=True,
        )
        reporters.append(reporter)

    first = make_listing("Graphics card")
    for index, reporter in enumerate(reporters):
        reported = client.post(
            f"/listings/{first}/report",
            json={"reason": "Scam", "details": f"Asked for a deposit first ({index})"},
            headers=_auth(reporter),
        )
        assert reported.status_code == 200, reported.text

    assert client.get(f"/listings/{first}").json()["status"] == "flagged"

    queue = client.get("/admin/reports", params={"limit": 200}, headers=_auth(ADMIN))
    assert queue.status_code == 200, queue.text
    rows = [row for row in queue.json() if row["listing_id"] == first]
    assert len(rows) == 3
    assert rows[0]["status"] == "open"
    assert rows[0]["reporter"]["display_name"].startswith("Reporter")
    assert rows[0]["listing"]["name"] == "Graphics card"
    assert rows[0]["details"]

    assert (
        client.post(f"/admin/reports/{rows[0]['id']}/dismiss", headers=_auth(STUDENT)).status_code
        == 403
    )

    for row in rows[:2]:
        dismissed = client.post(f"/admin/reports/{row['id']}/dismiss", headers=_auth(ADMIN))
        assert dismissed.status_code == 200, dismissed.text
        assert dismissed.json()["status"] == "dismissed"
    assert (
        client.get(f"/listings/{first}").json()["status"] == "flagged"
    ), "one open report should keep the listing hidden"

    last = client.post(f"/admin/reports/{rows[2]['id']}/dismiss", headers=_auth(ADMIN))
    assert last.status_code == 200, last.text
    assert (
        client.get(f"/listings/{first}").json()["status"] == "active"
    ), "dismissing every report should lift the report-only hide"
    assert (
        client.post(f"/admin/reports/{rows[2]['id']}/dismiss", headers=_auth(ADMIN)).status_code
        == 400
    ), "a resolved report can't be resolved twice"

    second = make_listing("Mini fridge")
    reported = client.post(
        f"/listings/{second}/report",
        json={"reason": "Not as described", "details": "Arrived broken"},
        headers=_auth(reporters[0]),
    )
    assert reported.status_code == 200, reported.text

    open_rows = [
        row
        for row in client.get("/admin/reports", params={"limit": 200}, headers=_auth(ADMIN)).json()
        if row["listing_id"] == second
    ]
    upheld = client.post(f"/admin/reports/{open_rows[0]['id']}/uphold", headers=_auth(ADMIN))
    assert upheld.status_code == 200, upheld.text
    assert client.get(f"/listings/{second}").status_code == 404

    audited = {row["action"] for row in client.get(
        "/admin/audit", params={"limit": 200}, headers=_auth(ADMIN)
    ).json()}
    assert {"report.dismiss", "report.uphold", "listing.delete"} <= audited


def test_audit_log_records_who_did_what():
    assert client.get("/admin/audit", headers=_auth(STUDENT)).status_code == 403

    res = client.get("/admin/audit", params={"limit": 200}, headers=_auth(ADMIN))
    assert res.status_code == 200, res.text
    rows = res.json()
    assert rows, "earlier tests should have produced audit entries"
    assert rows[0]["admin_email"] == "ksaifeld@charlotte.edu"
    assert str(rows[0]["created_at"]) >= str(rows[-1]["created_at"]), "newest first"

    actions = {row["action"] for row in rows}
    assert {"listing.delete", "user.flag", "user.delete", "user.restore"} <= actions

    filtered = client.get(
        "/admin/audit", params={"q": "rating.delete", "limit": 200}, headers=_auth(ADMIN)
    ).json()
    assert filtered
    assert all(row["action"] == "rating.delete" for row in filtered)


if __name__ == "__main__":
    test_admin_flag_is_reported_to_the_client()
    test_non_admins_are_locked_out()
    test_admin_can_browse_everything()
    test_admin_can_delete_any_listing()
    test_admin_can_delete_any_request()
    test_admin_can_delete_a_rating_and_recompute_the_average()
    test_admins_cannot_delete_themselves()
    test_admin_can_close_and_restore_an_account()
    test_admin_can_flag_an_account_so_its_posts_need_approval()
    test_three_bad_listings_in_a_row_flag_the_seller()
    test_report_queue_can_dismiss_reports_and_remove_a_listing()
    test_audit_log_records_who_did_what()
    print("ok")
