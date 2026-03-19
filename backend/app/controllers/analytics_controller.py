"""
Analytics Controller
====================
Admin-only endpoints that return real metrics from the database.
Access is enforced by verifying the "admin" role claim in the JWT.

This satisfies Sprint 3:
  - "At least one working rental-related analytic"    → carpool trip stats
  - "At least one gateway/service-level analytic"     → event-type breakdown
"""

from datetime import datetime, timedelta
from collections import defaultdict

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt

from ..extensions import db
from ..models import User, RidePost, CarpoolBooking
from ..models.analytics_event import AnalyticsEvent
from ..utils.responses import ok, fail

analytics_bp = Blueprint("analytics", __name__)


def _require_admin():
    """Return (None, error_response) or (claims, None)."""
    claims = get_jwt()
    if claims.get("role") != "admin":
        return None, fail("Admin access required", 403)
    return claims, None


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/analytics/summary
#   Returns high-level KPI counts for the admin dashboard cards.
# ──────────────────────────────────────────────────────────────────────────────
@analytics_bp.get("/summary")
@jwt_required()
def get_summary():
    _, err = _require_admin()
    if err:
        return err

    total_users     = User.query.count()
    total_rides     = RidePost.query.count()
    open_rides      = RidePost.query.filter_by(status="OPEN").count()
    full_rides      = RidePost.query.filter_by(status="FULL").count()

    total_bookings  = CarpoolBooking.query.count()
    accepted        = CarpoolBooking.query.filter_by(status="ACCEPTED").count()
    pending         = CarpoolBooking.query.filter_by(status="PENDING").count()
    rejected        = CarpoolBooking.query.filter_by(status="REJECTED").count()
    cancelled       = CarpoolBooking.query.filter_by(status="CANCELLED").count()

    # Rides created in the last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    rides_this_week = RidePost.query.filter(RidePost.created_at >= week_ago).count()
    users_this_week = User.query.filter(User.created_at >= week_ago).count()

    return ok({
        "users": {
            "total": total_users,
            "this_week": users_this_week,
        },
        "rides": {
            "total": total_rides,
            "open": open_rides,
            "full": full_rides,
            "this_week": rides_this_week,
        },
        "bookings": {
            "total": total_bookings,
            "accepted": accepted,
            "pending": pending,
            "rejected": rejected,
            "cancelled": cancelled,
            "acceptance_rate": round(accepted / total_bookings * 100, 1) if total_bookings else 0,
        },
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/analytics/events
#   Returns a breakdown of analytics events by type (from the observer log).
# ──────────────────────────────────────────────────────────────────────────────
@analytics_bp.get("/events")
@jwt_required()
def get_events():
    _, err = _require_admin()
    if err:
        return err

    # Count by event_type
    rows = (
        db.session.query(AnalyticsEvent.event_type, db.func.count(AnalyticsEvent.id))
        .group_by(AnalyticsEvent.event_type)
        .all()
    )
    by_type = {row[0]: row[1] for row in rows}

    # Total events
    total = sum(by_type.values())

    # Last 50 events (for recent-activity feed)
    recent = (
        AnalyticsEvent.query
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(50)
        .all()
    )

    return ok({
        "total_events": total,
        "by_type": by_type,
        "recent": [e.to_dict() for e in recent],
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/analytics/rides/daily?days=7
#   Returns daily ride creation counts for the last N days (sparkline data).
# ──────────────────────────────────────────────────────────────────────────────
@analytics_bp.get("/rides/daily")
@jwt_required()
def get_daily_rides():
    _, err = _require_admin()
    if err:
        return err

    try:
        days = int(request.args.get("days", 7))
        days = max(1, min(days, 90))
    except ValueError:
        return fail("days must be a positive integer", 400)

    since = datetime.utcnow() - timedelta(days=days)

    rides = (
        RidePost.query
        .filter(RidePost.created_at >= since)
        .all()
    )

    # Aggregate by date string YYYY-MM-DD
    counts: dict[str, int] = defaultdict(int)
    for ride in rides:
        day_key = ride.created_at.strftime("%Y-%m-%d")
        counts[day_key] += 1

    # Build ordered list for every day in the range
    result = []
    for i in range(days):
        day = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        result.append({"date": day, "rides": counts.get(day, 0)})

    return ok(result)


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/analytics/bookings/status
#   Booking status distribution (pie chart data).
# ──────────────────────────────────────────────────────────────────────────────
@analytics_bp.get("/bookings/status")
@jwt_required()
def get_booking_status_dist():
    _, err = _require_admin()
    if err:
        return err

    rows = (
        db.session.query(CarpoolBooking.status, db.func.count(CarpoolBooking.id))
        .group_by(CarpoolBooking.status)
        .all()
    )

    data = [{"status": row[0], "count": row[1]} for row in rows]
    return ok(data)


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/analytics/mobility/services
#   High-level info on all mobility services via the Factory pattern.
# ──────────────────────────────────────────────────────────────────────────────
@analytics_bp.get("/mobility/services")
@jwt_required()
def get_mobility_services():
    _, err = _require_admin()
    if err:
        return err

    from ..services.mobility_factory import MobilityServiceFactory
    services = MobilityServiceFactory.create_all()
    data = []
    for svc in services:
        try:
            info = svc.get_info()
            info["available"] = svc.is_available()
            data.append(info)
        except Exception as exc:
            data.append({
                "service_type": svc.service_type,
                "display_name": svc.display_name,
                "available": False,
                "error": str(exc),
            })

    return ok(data)
