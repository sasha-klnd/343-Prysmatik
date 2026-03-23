"""
Rating Controller
=================
Allows passengers to rate drivers after a completed ride (ACCEPTED booking).
One rating per booking. Driver's avg_driver_rating is updated atomically.

POST /api/ratings           { booking_id, stars, comment }
GET  /api/ratings/driver/<user_id>   — public driver profile with ratings
"""

import logging
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, CarpoolBooking
from ..models.ride_rating import RideRating
from ..utils.responses import ok, fail

rating_bp = Blueprint("ratings", __name__)
logger    = logging.getLogger(__name__)


@rating_bp.post("")
@jwt_required()
def rate_driver():
    rater_id = int(get_jwt_identity())
    data     = request.get_json(silent=True) or {}

    booking_id = data.get("booking_id")
    stars      = data.get("stars")
    comment    = (data.get("comment") or "").strip()[:500] or None

    if not booking_id:
        return fail("booking_id is required", 400)
    if stars not in (1, 2, 3, 4, 5):
        return fail("stars must be an integer between 1 and 5", 400)

    booking = CarpoolBooking.query.get(booking_id)
    if not booking:
        return fail("Booking not found", 404)
    if booking.passenger_user_id != rater_id:
        return fail("You can only rate rides you were a passenger on", 403)
    if booking.status != "ACCEPTED":
        return fail("You can only rate accepted (completed) rides", 400)

    # One rating per booking
    if booking.rating:
        return fail("You have already rated this ride", 409)

    ride = booking.ride_post
    driver = ride.creator

    rating = RideRating(
        booking_id    = booking_id,
        rater_id      = rater_id,
        rated_user_id = driver.id,
        stars         = stars,
        comment       = comment,
    )
    db.session.add(rating)

    # Recalculate driver's rolling average
    driver.total_ratings  = (driver.total_ratings or 0) + 1
    prev_avg = driver.avg_driver_rating or 0.0
    driver.avg_driver_rating = round(
        prev_avg + (stars - prev_avg) / driver.total_ratings, 2
    )

    db.session.commit()
    logger.info("Rating: user %s rated driver %s with %d stars", rater_id, driver.id, stars)
    return ok(rating.to_dict(), 201)


@rating_bp.get("/driver/<int:user_id>")
def driver_ratings(user_id: int):
    """Public endpoint — returns a driver's rating profile."""
    driver = User.query.get(user_id)
    if not driver:
        return fail("User not found", 404)

    recent_ratings = (
        RideRating.query
        .filter_by(rated_user_id=user_id)
        .order_by(RideRating.created_at.desc())
        .limit(20)
        .all()
    )

    return ok({
        "driver_id":        driver.id,
        "driver_name":      driver.full_name,
        "avg_rating":       driver.avg_driver_rating,
        "total_ratings":    driver.total_ratings,
        "recent_ratings": [r.to_dict() for r in recent_ratings],
    })
