import json
import logging
import os

from pywebpush import WebPushException, webpush

from database import db, push_subscriptions

logger = logging.getLogger("uvicorn.error")

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:support@ninermarket.com")


def _subscriptions_for(user_id: str) -> list[dict]:
    if db:
        return db.table("push_subscriptions").select("*").eq("user_id", user_id).execute().data
    return push_subscriptions.get(user_id, [])


def _drop_subscription(endpoint: str, user_id: str) -> None:
    if db:
        db.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
        return
    push_subscriptions[user_id] = [
        s for s in push_subscriptions.get(user_id, []) if s["endpoint"] != endpoint
    ]


def send_push(user_id: str, title: str, body: str, url: str = "/") -> None:
    """Best-effort Web Push to every device this user has subscribed on.
    Never raises — a failed push must not break whatever triggered it (a new
    notification or message), since it's a supplementary channel on top of
    the in-app badge/realtime signal, not the source of truth."""
    if not VAPID_PRIVATE_KEY:
        return
    try:
        subs = _subscriptions_for(user_id)
    except Exception:
        # e.g. the push_subscriptions table/migration hasn't been applied yet.
        logger.exception("failed to load push subscriptions")
        return
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
        except WebPushException as exc:
            # 404/410 means the browser dropped this subscription (uninstalled,
            # cleared permissions, etc) — stop trying to reach it.
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                _drop_subscription(sub["endpoint"], user_id)
            else:
                logger.warning("web push failed: %s", exc)
        except Exception:
            logger.exception("web push failed")
