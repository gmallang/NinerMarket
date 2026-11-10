"""Smoke checks for the Terms-of-Service photo screening.

Run from Backend/:  python test_image_moderation.py

No network: both provider calls are stubbed, so these cover the mapping from
provider categories -> Terms labels -> the 422 a seller sees, plus the fail-open
behaviour and which provider gets picked. Provider accuracy is not exercised.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)
os.environ["OPENAI_API_KEY"] = ""
os.environ["SIGHTENGINE_API_USER"] = ""
os.environ["SIGHTENGINE_API_SECRET"] = ""

from unittest.mock import patch  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

import image_moderation  # noqa: E402
import main  # noqa: E402
from auth import create_session_token  # noqa: E402

client = TestClient(main.app)

# A 1x1 PNG, small enough to pass the size and MIME checks.
PNG_1PX = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _openai_result(**flags) -> dict:
    """A moderation result whose category booleans default to False."""
    categories = {
        "harassment": False,
        "harassment/threatening": False,
        "hate": False,
        "hate/threatening": False,
        "illicit": None,
        "illicit/violent": None,
        "self-harm": False,
        "self-harm/instructions": False,
        "self-harm/intent": False,
        "sexual": False,
        "sexual/minors": False,
        "violence": False,
        "violence/graphic": False,
    }
    categories.update(flags)
    return {
        "flagged": any(v is True for v in categories.values()),
        "categories": categories,
        "category_scores": {k: (1.0 if v is True else 0.0) for k, v in categories.items()},
    }


def _sightengine_result(**blocks) -> dict:
    """A Sightengine success payload. Probabilities default to clearly safe."""
    payload = {
        "status": "success",
        "nudity": {
            "sexual_activity": 0.01,
            "sexual_display": 0.01,
            "erotica": 0.01,
            "very_suggestive": 0.01,
            "suggestive": 0.01,
        },
        "weapon": {"prob": 0.01, "classes": {}},
        "alcohol": {"prob": 0.01},
        "drugs": {"prob": 0.01},
    }
    for key, value in blocks.items():
        if key in ("weapon", "alcohol", "drugs"):
            payload[key] = {"prob": value}
        else:
            payload["nudity"][key] = value
    return payload


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_session_token(user_id)}"}


def _openai_stub(result):
    return (
        patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test", "SIGHTENGINE_API_USER": "", "SIGHTENGINE_API_SECRET": ""}),
        patch.object(image_moderation, "_openai_check", return_value=result),
    )


def _sightengine_stub(payload):
    return (
        patch.dict(
            os.environ,
            {"SIGHTENGINE_API_USER": "user", "SIGHTENGINE_API_SECRET": "secret", "OPENAI_API_KEY": ""},
        ),
        patch.object(image_moderation, "_sightengine_check", return_value=payload),
    )


def test_unconfigured_is_a_no_op():
    with patch.dict(
        os.environ,
        {"OPENAI_API_KEY": "", "SIGHTENGINE_API_USER": "", "SIGHTENGINE_API_SECRET": ""},
    ):
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []


def test_provider_failure_fails_open():
    key, check = _openai_stub(None)
    with key, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []

    user, check = _sightengine_stub(None)
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []


def test_which_provider_is_used():
    """Sightengine wins when it's configured; otherwise OpenAI is asked."""
    with patch.dict(
        os.environ,
        {"SIGHTENGINE_API_USER": "u", "SIGHTENGINE_API_SECRET": "s", "OPENAI_API_KEY": "sk-test"},
    ), patch.object(image_moderation, "_sightengine_check", return_value=_sightengine_result()) as se, patch.object(
        image_moderation, "_openai_check"
    ) as oa:
        image_moderation.find_image_violations(b"bytes", "image/png")
        assert se.called and not oa.called


def test_openai_category_mapping():
    key, check = _openai_stub(_openai_result())
    with key, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []

    key, check = _openai_stub(_openai_result(sexual=True))
    with key, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == [
            "nudity or sexual content"
        ]

    key, check = _openai_stub(_openai_result(illicit=True, **{"sexual/minors": True}))
    with key, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []


def test_sightengine_mapping():
    user, check = _sightengine_stub(_sightengine_result())
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []

    user, check = _sightengine_stub(_sightengine_result(sexual_display=0.92))
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == [
            "nudity or sexual content"
        ]

    # The categories OpenAI cannot see in a photo at all.
    user, check = _sightengine_stub(_sightengine_result(weapon=0.88))
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == ["weapons"]

    user, check = _sightengine_stub(_sightengine_result(alcohol=0.97))
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == ["alcohol"]

    user, check = _sightengine_stub(_sightengine_result(drugs=0.71))
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == [
            "drugs or drug paraphernalia"
        ]

    # Below the threshold is a pass, not a refusal.
    user, check = _sightengine_stub(_sightengine_result(alcohol=0.3))
    with user, check:
        assert image_moderation.find_image_violations(b"bytes", "image/png") == []


def test_upload_route_blocks_a_violating_photo():
    user, check = _sightengine_stub(_sightengine_result(alcohol=0.97))
    with user, check:
        r = client.post("/photos", json={"data_url": PNG_1PX}, headers=_auth("u-imagetest"))
    assert r.status_code == 422, r.text
    detail = r.json()["detail"]
    assert "alcohol" in detail
    assert "Terms" in detail


def test_upload_route_allows_a_clean_photo():
    user, check = _sightengine_stub(_sightengine_result())
    with user, check:
        r = client.post("/photos", json={"data_url": PNG_1PX}, headers=_auth("u-imagetest"))
    assert r.status_code == 200, r.text
    assert r.json()["url"].startswith("data:image/")


if __name__ == "__main__":
    test_unconfigured_is_a_no_op()
    test_provider_failure_fails_open()
    test_which_provider_is_used()
    test_openai_category_mapping()
    test_sightengine_mapping()
    test_upload_route_blocks_a_violating_photo()
    test_upload_route_allows_a_clean_photo()
    print("ok")
