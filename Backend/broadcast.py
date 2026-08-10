import json
import logging
import os
from urllib.request import Request, urlopen

logger = logging.getLogger("uvicorn.error")


def broadcast(topic: str, event: str, payload: dict) -> None:
    """Fires a Supabase Realtime broadcast so any subscribed browser tab
    updates instantly. Best-effort only — a failure here must never break the
    actual message send, since the message is already safely persisted by
    the time this runs."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    if not url or not key:
        return

    body = json.dumps(
        {"messages": [{"topic": topic, "event": event, "payload": payload}]}
    ).encode()
    req = Request(
        f"{url}/realtime/v1/api/broadcast",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=5) as resp:
            if not (200 <= resp.status < 300):
                logger.warning("realtime broadcast non-2xx: %s", resp.status)
    except Exception:
        logger.exception("realtime broadcast failed")
