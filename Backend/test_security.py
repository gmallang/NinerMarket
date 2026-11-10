"""Security regression checks: identity, the verify bypass, and photo gating.

Run from Backend/:  python test_security.py

Forces the in-memory store so the checks never touch the network, matching the
other test_*.py scripts. Each test uses its own account id because rate limits
are keyed per user.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from auth import create_session_token  # noqa: E402
from database import users as user_store  # noqa: E402
from ratelimit import client_ip  # noqa: E402

client = TestClient(main.app)

PNG_1PX = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def _signup(email: str, body_id: str = "", password: str = "correct-horse-battery"):
    local = email.split("@")[0]
    return client.post(
        "/users",
        json={
            "id": body_id or f"u-{local}",
            "email": email,
            "display_name": local.title(),
            "password": password,
        },
    )


def _listing(name: str, **extra) -> dict:
    payload = {
        "seller_id": "",
        "name": name,
        "price": 5,
        "category": "other",
        "condition": "Used",
        "description": "Security test listing",
        "pickup_location": "Student Union",
    }
    payload.update(extra)
    return payload


# ── identity ──────────────────────────────────────────────────────────────


def test_listing_seller_comes_from_the_session_not_the_body():
    """A seller_id in the body must never win - that's post-as-someone-else."""
    r = client.post(
        "/listings",
        json=_listing("Impersonation attempt", seller_id="u-someone-else"),
        headers=_auth("u-sec-seller"),
    )
    assert r.status_code == 200, r.text
    assert r.json()["seller_id"] == "u-sec-seller"


def test_patch_cannot_reassign_an_owner():
    created = client.post("/listings", json=_listing("Owner patch"), headers=_auth("u-sec-patch"))
    assert created.status_code == 200, created.text
    listing_id = created.json()["id"]

    r = client.patch(
        f"/listings/{listing_id}", json={"seller_id": "u-victim"}, headers=_auth("u-sec-patch")
    )
    assert r.status_code == 200, r.text
    assert r.json()["seller_id"] == "u-sec-patch"


def test_user_id_is_derived_from_the_email():
    """The client can't choose an id that belongs to someone else's address."""
    r = _signup("sec-derived@charlotte.edu", body_id="u-gmallang")
    assert r.status_code == 200, r.text
    assert r.json()["user"]["id"] == "u-sec-derived"
    # The body's id was ignored, so the already-seeded u-gmallang account still
    # belongs to whoever owns it.
    assert user_store["u-sec-derived"].email == "sec-derived@charlotte.edu"
    assert user_store["u-gmallang"].email != "sec-derived@charlotte.edu"


def test_profile_edit_is_an_allow_list_with_limits():
    _signup("sec-profile@charlotte.edu")
    r = client.patch(
        "/users/u-sec-profile",
        json={"display_name": "x" * 500, "email": "someone-else@charlotte.edu"},
        headers=_auth("u-sec-profile"),
    )
    assert r.status_code == 422, r.text
    assert user_store["u-sec-profile"].email == "sec-profile@charlotte.edu"


# ── the verify bypass ─────────────────────────────────────────────────────


def test_verify_rejects_a_wrong_code_and_issues_no_session():
    _signup("sec-unverified@charlotte.edu")
    r = client.post(
        "/users/verify", json={"email": "sec-unverified@charlotte.edu", "code": "000000"}
    )
    assert r.status_code == 400, r.text
    assert "token" not in r.json()


def test_verified_account_cannot_mint_a_session_without_a_code():
    email = "sec-verified@charlotte.edu"
    assert _signup(email).status_code == 200
    code = user_store["u-sec-verified"].verification_code

    ok = client.post("/users/verify", json={"email": email, "code": code})
    assert ok.status_code == 200, ok.text
    assert ok.json()["token"]

    # The old code path returned a fresh session token here for any caller who
    # simply knew the address.
    again = client.post("/users/verify", json={"email": email, "code": "123456"})
    assert again.status_code == 409, again.text
    assert "token" not in again.json()


# ── photos ────────────────────────────────────────────────────────────────


def test_external_photo_urls_are_rejected():
    """Hot-linking an image would skip the model screening entirely."""
    r = client.post(
        "/listings",
        json=_listing("Hotlink", photos=["https://example.com/nope.png"]),
        headers=_auth("u-sec-photo"),
    )
    assert r.status_code == 400, r.text


def test_uploaded_photo_urls_are_still_accepted():
    r = client.post(
        "/listings",
        json=_listing("Self-hosted", photos=[PNG_1PX]),
        headers=_auth("u-sec-photo-ok"),
    )
    assert r.status_code == 200, r.text
    assert r.json()["photos"][0].startswith("data:image/")


# ── client_ip ─────────────────────────────────────────────────────────────


class _FakeRequest:
    def __init__(self, forwarded: str):
        self.headers = {"x-forwarded-for": forwarded}
        self.client = None


def test_client_ip_uses_the_hop_our_proxy_appended():
    assert client_ip(_FakeRequest("9.9.9.9, 203.0.113.7")) == "203.0.113.7"


if __name__ == "__main__":
    test_listing_seller_comes_from_the_session_not_the_body()
    test_patch_cannot_reassign_an_owner()
    test_user_id_is_derived_from_the_email()
    test_profile_edit_is_an_allow_list_with_limits()
    test_verify_rejects_a_wrong_code_and_issues_no_session()
    test_verified_account_cannot_mint_a_session_without_a_code()
    test_external_photo_urls_are_rejected()
    test_uploaded_photo_urls_are_still_accepted()
    test_client_ip_uses_the_hop_our_proxy_appended()
    print("ok")
