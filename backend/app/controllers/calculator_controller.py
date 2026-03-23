"""
Calculator Controller (Issues 12 & 13)
=======================================
Exposes the CO2 and cost Strategy services via REST endpoints.
Also provides a trip summary endpoint used by the user dashboard (Issue 14).
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import CarpoolBooking, RidePost
from ..services.co2_service import CO2Calculator
from ..services.cost_service import CostCalculator
from ..utils.responses import ok, fail

calculator_bp = Blueprint("calculator", __name__)

SUPPORTED_MODES = ["car", "carpool", "transit", "bike", "walking"]


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/calculate/trip
# Body: { "mode": "carpool", "distance_km": 5.2, "occupants": 3 }
# Returns CO2, cost, and savings vs driving solo.
# ──────────────────────────────────────────────────────────────────────────────
@calculator_bp.post("/trip")
def calculate_trip():
    data = request.get_json(silent=True) or {}
    mode = (data.get("mode") or "").strip().lower()
    distance_km = data.get("distance_km")
    occupants = data.get("occupants", 2)

    if not mode:
        return fail("mode is required", 400)
    if mode not in SUPPORTED_MODES:
        return fail(f"Unknown mode. Supported: {SUPPORTED_MODES}", 400)
    if distance_km is None:
        return fail("distance_km is required", 400)

    try:
        distance_km = float(distance_km)
        occupants = int(occupants)
    except (TypeError, ValueError):
        return fail("distance_km must be a number; occupants must be an integer", 400)

    if distance_km <= 0:
        return fail("distance_km must be positive", 400)

    try:
        co2_kg     = CO2Calculator.calculate(mode, distance_km, occupants=occupants)
        co2_saved  = CO2Calculator.co2_saved_vs_car(mode, distance_km, occupants=occupants)
        cost_cad   = CostCalculator.calculate(mode, distance_km, occupants=occupants)
        money_saved = CostCalculator.savings_vs_car(mode, distance_km, occupants=occupants)
    except ValueError as exc:
        return fail(str(exc), 400)

    return ok({
        "mode": mode,
        "distance_km": distance_km,
        "occupants": occupants if mode == "carpool" else None,
        "co2_kg": co2_kg,
        "co2_saved_vs_car_kg": co2_saved,
        "cost_cad": cost_cad,
        "money_saved_vs_car_cad": money_saved,
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/calculate/modes?distance_km=5.2&occupants=2
# Returns a comparison table for all modes.
# ──────────────────────────────────────────────────────────────────────────────
@calculator_bp.get("/modes")
def compare_modes():
    distance_km_str = request.args.get("distance_km", "5.0")
    occupants_str   = request.args.get("occupants", "2")

    try:
        distance_km = float(distance_km_str)
        occupants   = int(occupants_str)
    except ValueError:
        return fail("distance_km must be a number; occupants must be an integer", 400)

    if distance_km <= 0:
        return fail("distance_km must be positive", 400)

    results = []
    for mode in SUPPORTED_MODES:
        co2_kg      = CO2Calculator.calculate(mode, distance_km, occupants=occupants)
        co2_saved   = CO2Calculator.co2_saved_vs_car(mode, distance_km, occupants=occupants)
        cost_cad    = CostCalculator.calculate(mode, distance_km, occupants=occupants)
        money_saved = CostCalculator.savings_vs_car(mode, distance_km, occupants=occupants)
        results.append({
            "mode": mode,
            "co2_kg": co2_kg,
            "co2_saved_vs_car_kg": co2_saved,
            "cost_cad": cost_cad,
            "money_saved_vs_car_cad": money_saved,
        })

    return ok({
        "distance_km": distance_km,
        "occupants": occupants,
        "modes": results,
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/calculate/my-stats
# Authenticated — returns real CO2 and cost totals for the dashboard.
# ──────────────────────────────────────────────────────────────────────────────
@calculator_bp.get("/my-stats")
@jwt_required()
def my_stats():
    user_id = int(get_jwt_identity())

    # Count accepted carpool bookings (as a passenger)
    accepted_bookings = (
        CarpoolBooking.query
        .filter_by(passenger_user_id=user_id, status="ACCEPTED")
        .all()
    )

    # Count rides offered (as a driver)
    offered_rides = RidePost.query.filter_by(creator_user_id=user_id).all()

    # Approximate stats — we don't store distance per booking yet,
    # so we use 6.5 km as the average urban trip distance for Montréal.
    AVG_TRIP_KM = 6.5
    OCCUPANTS   = 2       # conservative default for carpool occupancy

    total_trips    = len(accepted_bookings) + len(offered_rides)
    total_distance = total_trips * AVG_TRIP_KM

    # CO2 and cost for all carpool trips (vs solo car baseline)
    co2_total_kg   = CO2Calculator.calculate("carpool", total_distance, occupants=OCCUPANTS)
    co2_saved_kg   = CO2Calculator.co2_saved_vs_car("carpool", total_distance, occupants=OCCUPANTS)
    cost_total_cad = CostCalculator.calculate("carpool", total_distance, occupants=OCCUPANTS)
    money_saved_cad = CostCalculator.savings_vs_car("carpool", total_distance, occupants=OCCUPANTS)

    return ok({
        "total_trips": total_trips,
        "rides_offered": len(offered_rides),
        "rides_taken": len(accepted_bookings),
        "estimated_distance_km": round(total_distance, 1),
        "co2_total_kg": co2_total_kg,
        "co2_saved_kg": co2_saved_kg,
        "cost_total_cad": cost_total_cad,
        "money_saved_cad": money_saved_cad,
        "note": "Distance estimated at 6.5 km average per trip (Montréal urban average).",
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/calculate/route?from=...&to=...&mode=...
# Geocodes origin/destination and returns distance + CO2 + cost preview.
# Used by LogTripModal and AI screen for real distance computation.
# ──────────────────────────────────────────────────────────────────────────────
@calculator_bp.get("/route")
def calculate_route():
    origin      = (request.args.get("from") or "").strip()
    destination = (request.args.get("to")   or "").strip()
    mode        = (request.args.get("mode") or "transit").strip().lower()
    occupants   = int(request.args.get("occupants", 2))

    if not origin or not destination:
        return fail("'from' and 'to' query parameters are required", 400)

    if mode not in SUPPORTED_MODES:
        return fail(f"Unknown mode. Supported: {SUPPORTED_MODES}", 400)

    from ..utils.geocoding import distance_between
    dist_km = distance_between(origin, destination)

    if dist_km is None:
        return fail(
            "Could not geocode one or both addresses. "
            "Try adding 'Montréal' to your address (e.g. 'McGill University, Montréal').",
            422,
        )

    co2_kg       = CO2Calculator.calculate(mode, dist_km, occupants=occupants)
    co2_saved    = CO2Calculator.co2_saved_vs_car(mode, dist_km, occupants=occupants)
    cost_cad     = CostCalculator.calculate(mode, dist_km, occupants=occupants)
    money_saved  = CostCalculator.savings_vs_car(mode, dist_km, occupants=occupants)

    return ok({
        "from":               origin,
        "to":                 destination,
        "mode":               mode,
        "distance_km":        dist_km,
        "co2_kg":             co2_kg,
        "co2_saved_kg":       co2_saved,
        "cost_cad":           cost_cad,
        "money_saved_cad":    money_saved,
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/calculate/route-geometry?from=...&to=...&mode=...
# Geocodes addresses and fetches road geometry.
# Priority: landmarks dict → Google Maps API → OSRM fallback
# ──────────────────────────────────────────────────────────────────────────────
@calculator_bp.get("/route-geometry")
def route_geometry():
    import time
    import requests as req
    from ..utils.geocoding import geocode as geocode_address

    origin      = (request.args.get("from") or "").strip()
    destination = (request.args.get("to")   or "").strip()
    mode        = (request.args.get("mode") or "transit").strip().lower()

    if not origin or not destination:
        return fail("'from' and 'to' are required", 400)

    # Normalize mode aliases
    MODE_ALIASES = {
        "walk": "walking", "foot": "walking", "bicycle": "bike",
        "bixi": "bike", "cycling": "bike", "drive": "car", "driving": "car",
        "bus": "transit", "metro": "transit", "stm": "transit",
    }
    mode = MODE_ALIASES.get(mode.replace("+", " ").split()[0], mode)
    if mode not in ["transit", "bike", "walking", "car", "carpool"]:
        mode = "transit"

    # ── Step 1: Geocode both addresses ────────────────────────────────────────
    # FIX: removed the 50-line private geocode_address() closure that duplicated
    # utils/geocoding.geocode(). Using the shared utility directly now.
    MTL_CENTER = (45.5017, -73.5673)

    origin_coords = geocode_address(origin)
    time.sleep(0.2)
    dest_coords   = geocode_address(destination)

    geocode_warning = None
    if not origin_coords:
        geocode_warning = f"Could not locate '{origin}' — add it to landmarks if needed."
        origin_coords = MTL_CENTER
    if not dest_coords:
        geocode_warning = f"Could not locate '{destination}' — add it to landmarks if needed."
        dest_coords = (MTL_CENTER[0] + 0.01, MTL_CENTER[1] + 0.01)

    # ── Step 2: Get road geometry ─────────────────────────────────────────────
    route_coords = []
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

    if api_key:
        # Google Directions API — best quality routes
        google_mode_map = {
            "transit":  "transit",
            "bike":     "bicycling",
            "walking":  "walking",
            "car":      "driving",
            "carpool":  "driving",
        }
        g_mode = google_mode_map.get(mode, "driving")
        try:
            r = req.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin":      f"{origin_coords[0]},{origin_coords[1]}",
                    "destination": f"{dest_coords[0]},{dest_coords[1]}",
                    "mode":        g_mode,
                    "key":         api_key,
                },
                timeout=10,
            )
            data = r.json()
            if data.get("status") == "OK" and data.get("routes"):
                # Decode Google's encoded polyline
                encoded = data["routes"][0]["overview_polyline"]["points"]
                route_coords = _decode_polyline(encoded)
        except Exception as exc:
            pass  # fall through to OSRM

    if not route_coords:
        # OSRM fallback
        osrm_profile = {"bike": "bike", "walking": "foot"}.get(mode, "driving")
        try:
            r = req.get(
                f"https://router.project-osrm.org/route/v1/{osrm_profile}/"
                f"{origin_coords[1]},{origin_coords[0]};"
                f"{dest_coords[1]},{dest_coords[0]}"
                f"?overview=full&geometries=geojson",
                timeout=10,
            )
            data = r.json()
            if data.get("routes"):
                route_coords = [
                    [lat, lng]
                    for lng, lat in data["routes"][0]["geometry"]["coordinates"]
                ]
        except Exception:
            route_coords = [list(origin_coords), list(dest_coords)]

    return ok({
        "origin":       {"lat": origin_coords[0], "lon": origin_coords[1], "label": origin},
        "destination":  {"lat": dest_coords[0],   "lon": dest_coords[1],   "label": destination},
        "route_coords": route_coords,
        "mode":         mode,
        "warning":      geocode_warning,
    })


def _decode_polyline(encoded: str) -> list:
    """Decode Google's encoded polyline format into [[lat, lng], ...] list."""
    coords = []
    index = 0
    lat = 0
    lng = 0
    while index < len(encoded):
        for is_lng in [False, True]:
            result = 0
            shift = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            value = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += value
                coords.append([lat / 1e5, lng / 1e5])
            else:
                lat += value
    return coords

