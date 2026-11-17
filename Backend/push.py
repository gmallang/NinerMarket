import json
import logging
import os

import firebase_admin
from firebase_admin import credentials, messaging
from pywebpush import WebPushException, webpush

from database import db, push_subscriptions, push_tokens

logger = logging.getLogger("uvicorn.error")

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:support@ninermarket.com")
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

_firebase_app: firebase_admin.App | None = None
_firebase_init_tried = False


def _firebase() -> firebase_admin.App | None:
    """Lazily initializes the Firebase Admin SDK from a service account JSON
    env var. Returns None (and never raises) when it's unset or invalid -
    native push is an optional channel, not something the app should fail to
    start without, same as the VAPID key below."""
    global _firebase_app, _firebase_init_tried
    if _firebase_init_tried:
        return _firebase_app
    _firebase_init_tried = True
    if not FIREBASE_SERVICE_ACCOUNT_JSON:
        return None
    try:
        cred = credentials.Certificate(json.loads(FIREBASE_SERVICE_ACCOUNT_JSON))
        _firebase_app = firebase_admin.initialize_app(cred)
    except Exception:
        logger.exception("failed to initialize Firebase Admin SDK")
    return _firebase_app


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


def _tokens_for(user_id: str) -> list[dict]:
    if db:
        return db.table("push_tokens").select("*").eq("user_id", user_id).execute().data
    return push_tokens.get(user_id, [])


def _drop_token(token: str, user_id: str) -> None:
    if db:
        db.table("push_tokens").delete().eq("token", token).execute()
        return
    push_tokens[user_id] = [t for t in push_tokens.get(user_id, []) if t["token"] != token]


def _send_web_push(user_id: str, title: str, body: str, url: str) -> None:
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
            # cleared permissions, etc) - stop trying to reach it.
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                _drop_subscription(sub["endpoint"], user_id)
            else:
                logger.warning("web push failed: %s", exc)
        except Exception:
            logger.exception("web push failed")


def _send_fcm_push(user_id: str, title: str, body: str, url: str) -> None:
    app = _firebase()
    if app is None:
        return
    try:
        tokens = _tokens_for(user_id)
    except Exception:
        # e.g. the push_tokens table/migration hasn't been applied yet.
        logger.exception("failed to load push tokens")
        return
    for t in tokens:
        try:
            messaging.send(
                messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data={"url": url},
                    token=t["token"],
                ),
                app=app,
            )
        except messaging.UnregisteredError:
            # The OS dropped this token (app uninstalled, token rotated) -
            # stop trying to reach it.
            _drop_token(t["token"], user_id)
        except Exception:
            logger.warning("FCM push failed", exc_info=True)


def send_push(user_id: str, title: str, body: str, url: str = "/") -> None:
    """Best-effort push to every device this user has registered, across both
    channels (browser Web Push and native FCM for the wrapped app). Never
    raises - a failed push must not break whatever triggered it (a new
    notification or message), since it's a supplementary channel on top of
    the in-app badge/realtime signal, not the source of truth."""
    _send_web_push(user_id, title, body, url)
    _send_fcm_push(user_id, title, body, url)
