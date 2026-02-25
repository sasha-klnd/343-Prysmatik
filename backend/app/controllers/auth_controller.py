from flask import Blueprint, request, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from ..extensions import db, bcrypt
from ..models import User, UserPreferences
from ..utils.responses import ok, fail

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    phone = (data.get("phone") or "").strip() or None

    if not name or not email or not password:
        return fail("Missing required fields: name, email, password", 400)

    if User.query.filter_by(email=email).first():
        return fail("Email already in use", 409)

    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(full_name=name, email=email,
                password_hash=pw_hash, phone=phone)

    # Create default preferences row
    prefs = UserPreferences(user=user)
    db.session.add(user)
    db.session.add(prefs)
    db.session.commit()

    # JWT subject must be a string -> store user id as str
    token = create_access_token(identity=str(
        user.id), additional_claims={"role": "user"})
    return ok(
        {"token": token, "user": user.to_public_dict(), "preferences": prefs.to_dict()},
        201,
    )


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return fail("Missing email or password", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return fail("Invalid email or password", 401)

    token = create_access_token(identity=str(
        user.id), additional_claims={"role": "user"})
    prefs = user.preferences.to_dict() if user.preferences else None
    return ok({"token": token, "user": user.to_public_dict(), "preferences": prefs})


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)

    prefs = user.preferences.to_dict() if user.preferences else None
    return ok({"user": user.to_public_dict(), "preferences": prefs})


@auth_bp.post("/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return fail("Missing email or password", 400)

    admin_email = current_app.config.get("ADMIN_EMAIL", "").lower()
    admin_password = current_app.config.get("ADMIN_PASSWORD", "")

    if email != admin_email or password != admin_password:
        return fail("Invalid admin credentials", 401)

    token = create_access_token(
        identity="0", additional_claims={"role": "admin"})
    return ok({"token": token, "admin": {"email": admin_email}})
