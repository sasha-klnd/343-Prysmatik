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
