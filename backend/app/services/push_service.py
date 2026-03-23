"""
Push Notification Service — Firebase Cloud Messaging
=====================================================
Sends push notifications to users when their carpool booking status changes.

Set FIREBASE_CREDENTIALS_PATH in .env to enable.
Without it, all calls silently no-op so the app works without Firebase configured.

Setup:
  1. Create a Firebase project at https://console.firebase.google.com
  2. Project settings → Service accounts → Generate new private key
  3. Save the JSON file and set FIREBASE_CREDENTIALS_PATH=/path/to/key.json
"""

import logging
import os

logger = logging.getLogger(__name__)

_fcm_app = None


def _get_fcm():
    """Lazy-initialise the Firebase Admin SDK. Returns None if not configured."""
    global _fcm_app
    if _fcm_app is not None:
        return _fcm_app

    creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()
    if not creds_path or not os.path.isfile(creds_path):
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials
        if not firebase_admin._apps:
            cred = credentials.Certificate(creds_path)
            _fcm_app = firebase_admin.initialize_app(cred)
        else:
            _fcm_app = firebase_admin.get_app()
        logger.info("Firebase Admin SDK initialised")
        return _fcm_app
    except Exception as exc:
        logger.warning("Firebase init failed: %s", exc)
        return None


def send_push(fcm_token: str, title: str, body: str, data: dict | None = None) -> bool:
    """
    Send a push notification to a single device.
    Returns True on success, False (silently) on failure or if Firebase not configured.
    """
    if not fcm_token:
        return False

    app = _get_fcm()
    if app is None:
        return False

    try:
        from firebase_admin import messaging
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in (data or {}).items()},
            token=fcm_token,
        )
        messaging.send(msg)
        logger.info("Push sent to token …%s: %s", fcm_token[-6:], title)
        return True
    except Exception as exc:
        logger.warning("Push failed: %s", exc)
        return False


# ── Convenience wrappers used by ride_controller ──────────────────────────────

def notify_booking_approved(passenger_fcm: str, departure: str, destination: str):
    send_push(
        passenger_fcm,
        title="🚗 Ride request approved!",
        body=f"Your request for {departure} → {destination} was accepted. Check My Rides.",
        data={"screen": "my-rides", "status": "ACCEPTED"},
    )


def notify_booking_rejected(passenger_fcm: str, departure: str, destination: str):
    send_push(
        passenger_fcm,
        title="Ride request rejected",
        body=f"Your request for {departure} → {destination} wasn't accepted.",
        data={"screen": "my-rides", "status": "REJECTED"},
    )


def notify_booking_cancelled(driver_fcm: str, departure: str, destination: str):
    send_push(
        driver_fcm,
        title="Passenger cancelled",
        body=f"A passenger cancelled their request for {departure} → {destination}.",
        data={"screen": "my-rides"},
    )


def notify_new_request(driver_fcm: str, departure: str, destination: str, passenger_name: str):
    send_push(
        driver_fcm,
        title=f"New ride request from {passenger_name}",
        body=f"{departure} → {destination} — review it in My Rides.",
        data={"screen": "my-rides", "status": "PENDING"},
    )
