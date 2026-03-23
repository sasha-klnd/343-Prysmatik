import secrets
import logging
from flask import Blueprint, request, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from ..extensions import db, bcrypt
from ..models import User, UserPreferences
from ..utils.responses import ok, fail
from ..utils.emailer import send_email
from ..services.event_bus import EventBus

auth_bp = Blueprint("auth", __name__)
logger  = logging.getLogger(__name__)


def _make_tokens(user_id: int, role: str = "user") -> tuple[str, str]:
    """Return (access_token, refresh_token) pair."""
    claims = {"role": role}
    access  = create_access_token(identity=str(user_id), additional_claims=claims)
    refresh = create_refresh_token(identity=str(user_id), additional_claims=claims)
    return access, refresh


@auth_bp.post("/register")
def register():
    data  = request.get_json(silent=True) or {}
    name  = (data.get("name")     or "").strip()
    email = (data.get("email")    or "").strip().lower()
    pw    = data.get("password")  or ""
    phone = (data.get("phone")    or "").strip() or None

    if not name or not email or not pw:
        return fail("Missing required fields: name, email, password", 400)
    if User.query.filter_by(email=email).first():
        return fail("Email already in use", 409)

    pw_hash = bcrypt.generate_password_hash(pw).decode("utf-8")
    verif_token = secrets.token_urlsafe(32)

    user = User(
        full_name=name, email=email, password_hash=pw_hash,
        phone=phone, is_verified=False, verification_token=verif_token,
    )
    prefs = UserPreferences(user=user)
    db.session.add(user)
    db.session.add(prefs)
    db.session.commit()

    EventBus.publish("user_registered", user_id=user.id, metadata={"email": email})

    # Send verification email (best-effort — don't block registration on failure)
    try:
        _send_verification_email(user.email, user.full_name, verif_token)
    except Exception as exc:
        logger.warning("Verification email failed for %s: %s", email, exc)

    access, refresh = _make_tokens(user.id)
    return ok({
        "access_token":  access,
        "refresh_token": refresh,
        "token":         access,   # backward-compat alias
        "user":          user.to_public_dict(),
        "preferences":   prefs.to_dict(),
    }, 201)


@auth_bp.post("/login")
def login():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    pw    = data.get("password") or ""

    if not email or not pw:
        return fail("Missing email or password", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, pw):
        return fail("Invalid email or password", 401)

    # Update FCM token if provided
    fcm = (data.get("fcm_token") or "").strip()
    if fcm:
        user.fcm_token = fcm
        db.session.commit()

    prefs = user.preferences.to_dict() if user.preferences else None
    access, refresh = _make_tokens(user.id)
    return ok({
        "access_token":  access,
        "refresh_token": refresh,
        "token":         access,
        "user":          user.to_public_dict(),
        "preferences":   prefs,
    })


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    """Exchange a valid refresh token for a new access token."""
    user_id = int(get_jwt_identity())
    claims  = get_jwt()
    role    = claims.get("role", "user")
    access  = create_access_token(identity=str(user_id), additional_claims={"role": role})
    return ok({"access_token": access, "token": access})


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)
    prefs = user.preferences.to_dict() if user.preferences else None
    return ok({"user": user.to_public_dict(), "preferences": prefs})


@auth_bp.post("/verify-email/<token>")
def verify_email(token: str):
    """Click-through link from the verification email."""
    user = User.query.filter_by(verification_token=token).first()
    if not user:
        return fail("Invalid or expired verification link", 404)
    user.is_verified        = True
    user.verification_token = None
    db.session.commit()
    logger.info("Email verified for user %s", user.id)
    return ok({"verified": True, "email": user.email})


@auth_bp.post("/resend-verification")
@jwt_required()
def resend_verification():
    """Re-send the verification email to the logged-in user."""
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)
    if user.is_verified:
        return ok({"already_verified": True})

    token = secrets.token_urlsafe(32)
    user.verification_token = token
    db.session.commit()

    try:
        _send_verification_email(user.email, user.full_name, token)
    except Exception as exc:
        logger.warning("Resend verification failed: %s", exc)
        return fail("Failed to send email. Please try again later.", 500)

    return ok({"sent": True})


@auth_bp.post("/fcm-token")
@jwt_required()
def update_fcm_token():
    """Save or update the user's Firebase Cloud Messaging device token."""
    user_id = int(get_jwt_identity())
    data    = request.get_json(silent=True) or {}
    token   = (data.get("fcm_token") or "").strip()

    if not token:
        return fail("fcm_token is required", 400)

    user = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)

    user.fcm_token = token
    db.session.commit()
    return ok({"updated": True})


@auth_bp.post("/admin/login")
def admin_login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email")    or "").strip().lower()
    password = data.get("password")  or ""

    if not email or not password:
        return fail("Missing email or password", 400)

    admin_email    = current_app.config.get("ADMIN_EMAIL",    "").lower()
    admin_password = current_app.config.get("ADMIN_PASSWORD", "")

    if email != admin_email or password != admin_password:
        return fail("Invalid admin credentials", 401)

    access, _ = _make_tokens(0, role="admin")
    return ok({"access_token": access, "token": access, "admin": {"email": admin_email}})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _send_verification_email(to_email: str, name: str, token: str) -> None:
    frontend = "http://localhost:5173"
    verify_url = f"{frontend}/#/verify-email/{token}"
    body = (
        f"Hi {name},\n\n"
        f"Please verify your UrbiX email address by clicking the link below:\n\n"
        f"{verify_url}\n\n"
        f"This link is valid for 7 days.\n\n"
        f"— The UrbiX Team"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
      <h2 style="color:#4f46e5">Verify your UrbiX account</h2>
      <p>Hi {name},</p>
      <p>Please verify your email address to unlock all UrbiX features.</p>
      <a href="{verify_url}"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;
                border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
        Verify my email
      </a>
      <p style="color:#888;font-size:12px">
        If you didn't create an UrbiX account, you can ignore this email.
      </p>
    </div>"""
    send_email(to_email, "Verify your UrbiX email address", body, html=html)
