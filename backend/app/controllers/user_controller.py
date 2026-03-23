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

    # Issue 8 — carpool lifestyle preferences
    carpool_prefs = data.get("carpoolPreferences") or {}
    if "allowSmoking" in carpool_prefs:
        prefs.allow_smoking = bool(carpool_prefs["allowSmoking"])
    if "allowPets" in carpool_prefs:
        prefs.allow_pets = bool(carpool_prefs["allowPets"])
    if "musicOk" in carpool_prefs:
        prefs.music_ok = bool(carpool_prefs["musicOk"])
    if "chatty" in carpool_prefs:
        prefs.chatty = bool(carpool_prefs["chatty"])

    # Sync carpool lifestyle preferences to all OPEN rides by this user
    from ..models import RidePost
    open_rides = RidePost.query.filter_by(creator_user_id=user_id, status="OPEN").all()
    for ride in open_rides:
        ride.allow_smoking = prefs.allow_smoking
        ride.allow_pets    = prefs.allow_pets
        ride.music_ok      = prefs.music_ok
        ride.chatty        = prefs.chatty

    db.session.commit()
    return ok({**prefs.to_dict(), "rides_synced": len(open_rides)})


@users_bp.post("/me/preferences/ai-update")
@jwt_required()
def ai_update_preferences():
    """
    Called by the frontend when the user agrees to update a preference
    that the AI detected as contradicted.
    Body: { "field": "maxWalkingTime", "value": 20 }
    """
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)
    if not user:
        return fail("User not found", 404)

    data  = request.get_json(silent=True) or {}
    field = data.get("field")
    value = data.get("value")

    if not field or value is None:
        return fail("field and value are required", 400)

    prefs = user.preferences
    if not prefs:
        prefs = UserPreferences(user=user)
        db.session.add(prefs)

    # Map field names to model attributes
    field_map = {
        "maxWalkingTime":      lambda v: setattr(prefs, "max_walking_time",      int(v)),
        "budgetSensitivity":   lambda v: setattr(prefs, "budget_sensitivity",    int(v)),
        "preferCarpool":       lambda v: setattr(prefs, "prefer_carpool",       bool(v)),
        "preferTransit":       lambda v: setattr(prefs, "prefer_transit",       bool(v)),
        "preferBike":          lambda v: setattr(prefs, "prefer_bike",          bool(v)),
        "preferWalking":       lambda v: setattr(prefs, "prefer_walking",       bool(v)),
        "preferDriving":       lambda v: setattr(prefs, "prefer_driving",       bool(v)),
        "allowSmoking":        lambda v: setattr(prefs, "allow_smoking",        bool(v)),
        "allowPets":           lambda v: setattr(prefs, "allow_pets",           bool(v)),
        "musicOk":             lambda v: setattr(prefs, "music_ok",             bool(v)),
        "chatty":              lambda v: setattr(prefs, "chatty",               bool(v)),
    }

    if field not in field_map:
        return fail(f"Unknown preference field: {field}", 400)

    field_map[field](value)
    db.session.commit()

    return ok({
        "updated": field,
        "value":   value,
        "preferences": prefs.to_dict(),
    })
