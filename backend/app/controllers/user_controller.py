from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, UserPreferences
from ..utils.responses import ok, fail

users_bp = Blueprint("users", __name__)


@users_bp.get("/me")
@jwt_required()
def get_me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)
    return ok(user.to_public_dict())


@users_bp.get("/me/preferences")
@jwt_required()
def get_my_preferences():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)

    if not user.preferences:
        user.preferences = UserPreferences(user=user)
        db.session.commit()

    return ok(user.preferences.to_dict())


@users_bp.put("/me/preferences")
@jwt_required()
def update_my_preferences():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)

    data = request.get_json(silent=True) or {}

    prefs = user.preferences
    if not prefs:
        prefs = UserPreferences(user=user)
        db.session.add(prefs)

    # Scalars
    if "maxWalkingTime" in data:
        prefs.max_walking_time = int(data["maxWalkingTime"])
    if "budgetSensitivity" in data:
        prefs.budget_sensitivity = int(data["budgetSensitivity"])
    if "useByDefault" in data:
        prefs.use_by_default = bool(data["useByDefault"])

    # preferredModes
    preferred = data.get("preferredModes") or {}
    if "transit" in preferred:
        prefs.prefer_transit = bool(preferred["transit"])
    if "bike" in preferred:
        prefs.prefer_bike = bool(preferred["bike"])
    if "carpool" in preferred:
        prefs.prefer_carpool = bool(preferred["carpool"])
    if "driving" in preferred:
        prefs.prefer_driving = bool(preferred["driving"])
    if "walking" in preferred:
        prefs.prefer_walking = bool(preferred["walking"])

    # accessibility
    access = data.get("accessibility") or {}
    if "wheelchairAccessible" in access:
        prefs.wheelchair_accessible = bool(access["wheelchairAccessible"])
    if "elevatorRequired" in access:
        prefs.elevator_required = bool(access["elevatorRequired"])
    if "avoidStairs" in access:
        prefs.avoid_stairs = bool(access["avoidStairs"])

    db.session.commit()
    return ok(prefs.to_dict())
