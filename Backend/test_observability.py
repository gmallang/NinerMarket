"""Regression checks for request IDs, unhandled-error responses, and health.

Run from Backend/:  python test_observability.py

The bug these pin down: an unhandled exception used to produce a bodyless 500
with no CORS header, so the browser reported it as a CORS policy failure and
the real cause stayed invisible. Both the JSON body and the CORS header are
asserted here because getting one without the other was the failure mode.
"""

import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ.pop("VERCEL", None)
os.environ.pop("LOG_JSON", None)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

ORIGIN = "https://www.ninermarket.com"


def _boom():
    raise RuntimeError("boom - the message must not reach the client")


# Registered on purpose: this is the only way to exercise the unhandled-error
# path that a real route bug takes.
main.app.add_api_route("/__test_boom", _boom, methods=["GET"])

client = TestClient(main.app)


def test_liveness_does_not_touch_external_services():
    r = client.get("/healthz")
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}


def test_readiness_reports_the_in_memory_store():
    r = client.get("/readyz")
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True, "store": "memory"}


def test_supplied_request_id_is_echoed_back():
    r = client.get("/healthz", headers={"X-Request-Id": "abc-123"})
    assert r.headers.get("x-request-id") == "abc-123"


def test_request_id_is_generated_when_absent():
    r = client.get("/healthz")
    generated = r.headers.get("x-request-id", "")
    assert generated and len(generated) == 16


def test_hostile_request_id_is_replaced_not_reflected():
    """A newline in the header would let a client forge log lines."""
    r = client.get("/healthz", headers={"X-Request-Id": "bad id with spaces"})
    assert r.headers.get("x-request-id") != "bad id with spaces"
    assert len(r.headers.get("x-request-id", "")) == 16


def test_unhandled_error_returns_json_with_a_request_id():
    r = client.get("/__test_boom", headers={"Origin": ORIGIN})
    assert r.status_code == 500, r.text
    body = r.json()
    assert body["detail"] == "Internal server error"
    assert body["error"] == "RuntimeError"
    assert body["request_id"] == r.headers["x-request-id"]
    # The exception message must stay in the server log.
    assert "boom" not in r.text


def test_unhandled_error_keeps_cors_headers():
    """Without this the browser reports the 500 as a CORS failure."""
    r = client.get("/__test_boom", headers={"Origin": ORIGIN})
    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") in ("*", ORIGIN)


if __name__ == "__main__":
    test_liveness_does_not_touch_external_services()
    test_readiness_reports_the_in_memory_store()
    test_supplied_request_id_is_echoed_back()
    test_request_id_is_generated_when_absent()
    test_hostile_request_id_is_replaced_not_reflected()
    test_unhandled_error_returns_json_with_a_request_id()
    test_unhandled_error_keeps_cors_headers()
    print("ok")
