"""
AI Controller
=============
Proxies requests to the Anthropic API server-side.
Uses geographic proximity matching (not text matching) to find carpool rides
that are near the user's origin/destination, even if names don't match exactly.
"""

import os
import logging
import traceback
import requests
from datetime import datetime

from flask import Blueprint, request
from ..utils.responses import ok, fail
from ..utils.geocoding import geocode as _geocode, haversine_km as _haversine_km
from ..models import RidePost, CarpoolBooking
from ..services.stm_service import is_configured as stm_configured

ai_bp = Blueprint("ai", __name__)
logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL   = "claude-sonnet-4-6"

ORIGIN_RADIUS_KM      = 5.0
DESTINATION_RADIUS_KM = 5.0


def _suggest_connector(dist_km: float) -> str:
    if dist_km <= 0.8:
        return "walking"
    elif dist_km <= 4.0:
        return "BIXI bike"
    else:
        return "public transit (STM)"


def _build_preferences_context(prefs: dict) -> str:
    if not prefs.get("useByDefault", True):
        return "USER PREFERENCES: User has disabled default preferences. Suggest any options freely."

    max_walk = prefs.get("maxWalkingTime", 15)
    budget   = prefs.get("budgetSensitivity", 50)
    modes    = prefs.get("preferredModes", {})
    access   = prefs.get("accessibility", {})
    cp       = prefs.get("carpoolPreferences", {})

    MODE_MAP = {"transit": "transit", "bike": "bike", "walking": "walking",
                "driving": "car", "carpool": "carpool"}

    enabled_modes  = [MODE_MAP[m] for m, v in modes.items() if v     and m in MODE_MAP]
    disabled_modes = [MODE_MAP[m] for m, v in modes.items() if not v and m in MODE_MAP]
    max_walk_km = round(max_walk / 60 * 5, 1)

    lines = [
        "=" * 60,
        "USER PREFERENCES — MANDATORY RULES (apply to every response):",
        "=" * 60,
        "",
        f"MAX WALKING: {max_walk} minutes (~{max_walk_km} km).",
        f"  -> NEVER include a walking segment longer than {max_walk} min in any plan card.",
        f"  -> If a route requires more than {max_walk} min walking, DO NOT show it as a plan card.",
        f"  -> Instead, mention it in text as: 'Near-miss: this option needs X min walking.'",
        "",
    ]

    if enabled_modes:
        lines += [f"ALLOWED MODES: {', '.join(enabled_modes)}.",
                  "  -> Only generate plan cards using these modes."]
    if disabled_modes:
        lines += [f"FORBIDDEN MODES: {', '.join(disabled_modes)}.",
                  "  -> NEVER include these modes in any plan card, step, or recommendation.",
                  "  -> Do not mention 'car', 'drive', or any forbidden mode anywhere in plan cards.",
                  "  -> Exception: if user explicitly asks for a forbidden mode in THIS message, comply but warn them."]
    lines.append("")

    if budget >= 70:
        lines += [f"BUDGET: Very cost-sensitive ({budget}/100).",
                  "  -> Always sort plan cards by price, cheapest first.",
                  "  -> Highlight the cost of each option prominently.",
                  "  -> Prefer free options (walking, BIXI within free window) over paid ones.",
                  "  -> Only show expensive options (car, paid parking) if no cheaper option exists.", ""]
    elif budget >= 40:
        lines += [f"BUDGET: Moderately cost-sensitive ({budget}/100).",
                  "  -> Balance cost and convenience. Show cost clearly for each option.", ""]
    else:
        lines += [f"BUDGET: Cost not a priority ({budget}/100).",
                  "  -> User values comfort/speed. Show fastest or most comfortable options first.", ""]

    if access.get("wheelchairAccessible"):
        lines += ["ACCESSIBILITY: Wheelchair accessible routes ONLY.",
                  "  -> Only suggest metro stations and buses with wheelchair access.",
                  "  -> Never suggest routes requiring stairs.", ""]
    elif access.get("elevatorRequired"):
        lines += ["ACCESSIBILITY: Elevator required.",
                  "  -> All transit connections must have elevator access.", ""]
    elif access.get("avoidStairs"):
        lines += ["ACCESSIBILITY: Prefers to avoid stairs.",
                  "  -> Prefer routes with ramps/elevators when available.", ""]

    carpool_rules = []
    if not cp.get("allowSmoking", False): carpool_rules.append("NO smoking allowed in carpool rides")
    if cp.get("allowPets", False):        carpool_rules.append("pets are welcome")
    if not cp.get("musicOk", True):      carpool_rules.append("prefers quiet rides (no music)")
    elif cp.get("musicOk", True):        carpool_rules.append("music OK")
    if cp.get("chatty", True):            carpool_rules.append("enjoys chatty conversation during rides")
    else:                                  carpool_rules.append("prefers quiet/no-conversation rides")

    if carpool_rules:
        lines += [f"CARPOOL PREFERENCES: {'; '.join(carpool_rules)}.",
                  "  -> Only suggest carpool rides that match ALL of these preferences.",
                  "  -> If the only available ride violates a preference, mention it as a note but mark it.", ""]

    lines += [
        "CONTRADICTION DETECTION:",
        "  -> If the user's message in THIS turn contradicts their preferences above,",
        "    politely note it AND add 'preference_update' to your JSON response:",
        '    "preference_update": {"field": "maxWalkingTime", "current_value": 10,',
        '     "suggested_value": 25, "reason": "Your request requires a 25-min walk"}',
        "  -> Supported fields: maxWalkingTime, budgetSensitivity,",
        "    preferCarpool, preferTransit, preferBike, preferWalking, preferDriving,",
        "    allowSmoking, allowPets, musicOk, chatty",
        "",
        "=" * 60,
    ]
    return "\n".join(lines)


def _find_nearby_rides(
    origin: str,
    destination: str,
    origin_coords: tuple | None,
    dest_coords: tuple | None,
    origin_radius: float = ORIGIN_RADIUS_KM,
    dest_radius: float = DESTINATION_RADIUS_KM,
    user_preferences: dict | None = None,
    exclude_user_id: int | None = None,
) -> list[dict]:
    user_prefs = user_preferences or {}
    # NOTE: We intentionally do NOT hard-filter by smoking/music/pets preferences here.
    # The AI will flag mismatches in its explanation. Hard-filtering here causes rides
    # to silently disappear even when the user would want to see them.
    exclude_id = int(exclude_user_id) if exclude_user_id is not None else None

    rides = RidePost.query.filter(
        RidePost.status == "OPEN",
        RidePost.departure_datetime > datetime.utcnow(),
    ).order_by(RidePost.departure_datetime.asc()).limit(100).all()

    results = []

    for ride in rides:
        # FIX: use the real model field creator_user_id (not the non-existent creator_id)
        if exclude_id is not None and ride.creator_user_id == exclude_id:
            continue

        ride_dep_coords  = _geocode(ride.departure)
        ride_dest_coords = _geocode(ride.destination)
        if not ride_dep_coords or not ride_dest_coords:
            continue

        gap_to_pickup = (
            _haversine_km(origin_coords[0], origin_coords[1],
                          ride_dep_coords[0], ride_dep_coords[1])
            if origin_coords else 999
        )
        gap_from_dropoff = (
            _haversine_km(ride_dest_coords[0], ride_dest_coords[1],
                          dest_coords[0], dest_coords[1])
            if dest_coords else 999
        )

        if gap_to_pickup <= origin_radius and gap_from_dropoff <= dest_radius:
            accepted = CarpoolBooking.query.filter_by(
                ride_post_id=ride.id, status="ACCEPTED"
            ).count()

            # FIX: renamed from `prefs` to `ride_pref_tags` — avoids shadowing
            # the outer user_prefs/cp variables in the same function scope
            ride_pref_tags = []
            if ride.allow_smoking: ride_pref_tags.append("smoking OK")
            if ride.allow_pets:    ride_pref_tags.append("pets OK")
            if ride.music_ok:      ride_pref_tags.append("music OK")
            if ride.chatty:        ride_pref_tags.append("chatty")

            # Check if ride preferences conflict with user preferences
            cp = user_prefs.get("carpoolPreferences", {})
            pref_warnings = []
            if not cp.get("allowSmoking", False) and ride.allow_smoking:
                pref_warnings.append("ride allows smoking (your preference: no smoking)")
            if not cp.get("musicOk", True) and ride.music_ok:
                pref_warnings.append("ride has music (your preference: no music)")
            if cp.get("allowPets", False) and not ride.allow_pets:
                pref_warnings.append("ride doesn't allow pets (your preference: pets OK)")

            results.append({
                "id":                  ride.id,
                "departure":           ride.departure,
                "destination":         ride.destination,
                "datetime":            ride.departure_datetime.strftime("%Y-%m-%d %H:%M"),
                "seats":               ride.seats_available,
                "driver":              ride.creator.full_name if ride.creator else "Unknown",
                "passengers":          accepted,
                "preferences":         ", ".join(ride_pref_tags) if ride_pref_tags else "no specific preferences",
                "pref_warnings":       pref_warnings,
                "gap_to_pickup_km":    round(gap_to_pickup, 2),
                "gap_from_dropoff_km": round(gap_from_dropoff, 2),
                "pickup_connector":    _suggest_connector(gap_to_pickup),
                "dropoff_connector":   _suggest_connector(gap_from_dropoff),
            })

    results.sort(key=lambda r: r["gap_to_pickup_km"] + r["gap_from_dropoff_km"])
    return results[:5]


def _build_carpool_context(rides: list[dict], origin: str, destination: str, radius_km: float = ORIGIN_RADIUS_KM) -> str:
    if not rides:
        return (
            f"No carpool rides found near '{origin}' -> '{destination}' "
            f"(within {radius_km} km radius on both ends). "
            "Do NOT suggest carpool."
        )

    lines = [
        f"CARPOOL RIDES NEAR THE USER'S ROUTE ({len(rides)} found within {radius_km} km):",
        "",
        "These rides may not start/end exactly at the user's locations, but are close enough.",
        "For each ride below, the connector legs are pre-calculated.",
        "",
    ]
    for r in rides:
        lines.append(f"Ride #{r['id']}: {r['departure']} -> {r['destination']}")
        lines.append(f"  Departs: {r['datetime']} | Seats: {r['seats']} | Driver: {r['driver']}")
        lines.append(f"  Preferences: {r['preferences']}")
        if r.get('pref_warnings'):
            lines.append(f"  ⚠️  PREFERENCE MISMATCH: {'; '.join(r['pref_warnings'])}. Still include this ride but mention the mismatch in the explanation.")
        lines.append(f"  <- Gap from user's origin to pickup: {r['gap_to_pickup_km']} km "
                     f"(suggest: {r['pickup_connector']})")
        lines.append(f"  -> Gap from dropoff to user's destination: {r['gap_from_dropoff_km']} km "
                     f"(suggest: {r['dropoff_connector']})")
        lines.append("")

    return "\n".join(lines)


# ── Main endpoint ─────────────────────────────────────────────────────────────

@ai_bp.post("/chat")
def chat():
    data             = request.get_json(silent=True) or {}
    messages         = data.get("messages")
    system           = data.get("system", "")
    origin           = (data.get("origin") or "").strip()
    destination      = (data.get("destination") or "").strip()
    user_preferences = data.get("user_preferences") or {}
    # FIX: removed the duplicate assignment that existed on two consecutive lines
    current_user_id  = data.get("current_user_id")

    if not messages or not isinstance(messages, list):
        return fail("messages array is required", 400)

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return fail("ANTHROPIC_API_KEY is not configured on the server.", 500)

    matching_rides = []

    try:
        if user_preferences:
            prefs_context = _build_preferences_context(user_preferences)
            system = system + f"\n\n{prefs_context}"
    except Exception:
        logger.warning("Preferences context failed: %s", traceback.format_exc())

    try:
        if origin and destination:
            origin_coords  = _geocode(origin)
            dest_coords    = _geocode(destination)
            max_walk_min   = user_preferences.get("maxWalkingTime", 15)
            # Walking speed ~5 km/h. Add 50% buffer for transit connector options.
            # Cap at 10 km so we don't miss rides where transit bridges the gap.
            walk_radius_km = min(round((max_walk_min / 60) * 5 * 1.5, 1), 10.0)
            matching_rides = _find_nearby_rides(
                origin, destination, origin_coords, dest_coords,
                origin_radius=walk_radius_km, dest_radius=walk_radius_km,
                user_preferences=user_preferences,
                exclude_user_id=current_user_id,
            )
            carpool_ctx = _build_carpool_context(matching_rides, origin, destination, radius_km=walk_radius_km)
            system = system + f"\n\n{carpool_ctx}\n\n" + (
                "CARPOOL RULES -- follow exactly:\n"
                "- Include a carpool plan for every ride listed above, even if preferences don't fully match.\n"
                "- The carpool plan must be a MULTI-SEGMENT trip:\n"
                "  Segment 1: User travels from their origin to the ride's departure point "
                "  using the suggested pickup_connector (if gap_to_pickup_km is within max walking time use Walk, else use Transit).\n"
                "  Segment 2: Carpool ride itself (departure -> destination from DB).\n"
                "  Segment 3: User travels from ride destination to their final destination "
                "  using the suggested dropoff_connector (if gap_from_dropoff_km is within max walking time use Walk, else use Transit).\n"
                "- PREFERENCE MISMATCH: If a ride has a PREFERENCE MISMATCH warning above, "
                "  STILL include the plan but add a clear note in the explanation, e.g. "
                "  '⚠️ Note: this ride allows smoking which conflicts with your no-smoking preference.' "
                "  Never silently drop a ride for preference reasons — let the user decide.\n"
                "- Set mode='carpool' for the overall plan.\n"
                "- Set 'from' to the EXACT ride departure string from DB (copy verbatim).\n"
                "- Set 'to' to the EXACT ride destination string from DB (copy verbatim).\n"
                "- Add 'ride_id' field with the numeric ride ID.\n"
                "- In 'steps', use short mode labels: Walk / Transit / Carpool.\n"
                "- In 'explanation', mention full journey with km gaps and any preference warnings.\n"
                "- If no rides are listed above, do NOT suggest carpool."
            )
    except Exception:
        logger.warning("Geocoding/carpool lookup failed (non-fatal): %s", traceback.format_exc())

    # ── Inject STM real-time status if API is configured ─────────────────────
    try:
        if stm_configured():
            from ..services.stm_service import is_configured
            system = system + (
                "\n\nSTM REAL-TIME STATUS: The Montreal STM GTFS-RT API is connected. "
                "When suggesting transit routes, you may note that real-time departure data "
                "is available — users can ask about specific STM stop IDs to get live next-bus times. "
                "STM stop IDs are 5-digit numbers (e.g. stop 51515 = Berri-UQAM)."
            )
    except Exception:
        pass  # STM context is non-critical

    payload = {
        "model":      ANTHROPIC_MODEL,
        "max_tokens": 3000,
        "messages":   messages,
    }
    if system:
        payload["system"] = system

    try:
        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key":         api_key,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()

        result = resp.json()
        result["matched_carpool_rides"] = matching_rides
        return ok(result)

    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response else 500
        try:
            detail = exc.response.json()
        except Exception:
            detail = str(exc)
        logger.error("Anthropic API error %s: %s", status, detail)
        return fail(f"Anthropic API error: {detail}", status)

    except Exception as exc:
        logger.error("AI proxy error: %s\n%s", exc, traceback.format_exc())
        return fail(str(exc), 500)
