"""
Trip Controller
===============
Allows authenticated users to manually log trips they actually took.
This feeds the real CO2 / cost dashboard (Issue 14).

POST /api/trips/log        — log a trip
GET  /api/trips/mine       — get my trip history
GET  /api/trips/my-stats   — get real aggregated CO2 / cost stats
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import CarpoolBooking
from ..models.trip import Trip
from ..services.co2_service import CO2Calculator
from ..services.cost_service import CostCalculator
from ..services.event_bus import EventBus
from ..utils.responses import ok, fail

trip_bp = Blueprint("trips", __name__)

VALID_MODES = ["carpool", "transit", "bike", "walking", "car"]


# ── POST /api/trips/log ───────────────────────────────────────────────────────
@trip_bp.post("/log")
@jwt_required()
def log_trip():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    mode        = (data.get("mode") or "").strip().lower()
    distance_km = data.get("distance_km")
    note        = (data.get("note") or "").strip() or None

    if not mode or mode not in VALID_MODES:
        return fail(f"mode is required. Valid modes: {VALID_MODES}", 400)

    if distance_km is None:
        return fail("distance_km is required", 400)

    try:
        distance_km = float(distance_km)
    except (TypeError, ValueError):
        return fail("distance_km must be a number", 400)

    if distance_km <= 0 or distance_km > 500:
        return fail("distance_km must be between 0 and 500", 400)

    # Compute CO2 + cost for this trip
    occupants = int(data.get("occupants", 2)) if mode == "carpool" else 1
    co2_kg    = CO2Calculator.calculate(mode, distance_km, occupants=occupants)
    cost_cad  = CostCalculator.calculate(mode, distance_km, occupants=occupants)

    trip = Trip(
        user_id=user_id,
        mode=mode,
        distance_km=distance_km,
        note=note,
    )
    db.session.add(trip)
    db.session.commit()

    # Publish observer event
    EventBus.publish("trip_logged", user_id=user_id, metadata={
        "trip_id": trip.id, "mode": mode, "distance_km": distance_km
    })
    db.session.commit()

    return ok({
        "trip":     trip.to_dict(),
        "co2_kg":   co2_kg,
        "cost_cad": cost_cad,
        "co2_saved_vs_car": CO2Calculator.co2_saved_vs_car(mode, distance_km, occupants=occupants),
        "money_saved_vs_car": CostCalculator.savings_vs_car(mode, distance_km, occupants=occupants),
    }, 201)


# ── GET /api/trips/mine ───────────────────────────────────────────────────────
@trip_bp.get("/mine")
@jwt_required()
def my_trips():
    user_id = int(get_jwt_identity())
    trips = (
        Trip.query
        .filter_by(user_id=user_id)
        .order_by(Trip.created_at.desc())
        .limit(100)
        .all()
    )
    return ok([t.to_dict() for t in trips])


# ── GET /api/trips/my-stats ───────────────────────────────────────────────────
@trip_bp.get("/my-stats")
@jwt_required()
def my_stats():
    user_id = int(get_jwt_identity())

    # All manually logged trips
    trips = Trip.query.filter_by(user_id=user_id).all()

    # Also count accepted carpool bookings not yet manually logged
    accepted_bookings = CarpoolBooking.query.filter_by(
        passenger_user_id=user_id, status="ACCEPTED"
    ).count()

    offered_rides_count = db.session.execute(
        db.text("SELECT COUNT(*) FROM ride_posts WHERE creator_user_id = :uid"),
        {"uid": user_id}
    ).scalar() or 0

    # Aggregate per mode
    mode_totals: dict[str, float] = {}
    total_co2_kg    = 0.0
    total_cost_cad  = 0.0
    total_co2_saved = 0.0
    total_money_saved = 0.0

    for trip in trips:
        dist = trip.distance_km
        mode = trip.mode
        occ  = 2 if mode == "carpool" else 1

        co2     = CO2Calculator.calculate(mode, dist, occupants=occ)
        cost    = CostCalculator.calculate(mode, dist, occupants=occ)
        saved_co2   = CO2Calculator.co2_saved_vs_car(mode, dist, occupants=occ)
        saved_money = CostCalculator.savings_vs_car(mode, dist, occupants=occ)

        total_co2_kg      += co2
        total_cost_cad    += cost
        total_co2_saved   += saved_co2
        total_money_saved += saved_money

        mode_totals[mode] = mode_totals.get(mode, 0.0) + dist

    # Per-mode breakdown for the UI
    mode_breakdown = [
        {
            "mode":        mode,
            "distance_km": round(dist, 1),
            "trips":       sum(1 for t in trips if t.mode == mode),
        }
        for mode, dist in mode_totals.items()
    ]

    return ok({
        "total_trips":        len(trips),
        "rides_offered":      offered_rides_count,
        "rides_taken":        accepted_bookings,
        "total_distance_km":  round(sum(t.distance_km for t in trips), 1),
        "co2_total_kg":       round(total_co2_kg, 3),
        "co2_saved_kg":       round(total_co2_saved, 3),
        "cost_total_cad":     round(total_cost_cad, 2),
        "money_saved_cad":    round(total_money_saved, 2),
        "mode_breakdown":     mode_breakdown,
        "note": "Based on trips you have logged. Log more trips to improve accuracy.",
    })
