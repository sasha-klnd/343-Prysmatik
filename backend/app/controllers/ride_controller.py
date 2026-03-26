from datetime import datetime, timedelta
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, RidePost, CarpoolBooking
from ..utils.responses import ok, fail
from ..utils.emailer import send_email
from ..utils.email_templates import urbix_email_html
from ..services.event_bus import EventBus

ride_bp = Blueprint("rides", __name__)

AUTO_REJECT_AFTER = timedelta(hours=24)


def parse_departure_datetime(date_str: str, time_str: str) -> datetime:
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")


def _now():
    return datetime.utcnow()


def _current_user():
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


def _ride_rows(ride: RidePost, *, seats: int | None = None, status: str | None = None):
    rows = [
        ("Route", f"{ride.departure} → {ride.destination}"),
        ("Departure", ride.departure_datetime.isoformat()),
        ("Seats available", str(ride.seats_available)),
    ]
    if seats is not None:
        rows.append(("Seats requested", str(seats)))
    if status is not None:
        rows.append(("Status", status))
    return rows


def auto_reject_expired_requests():
    """Reject PENDING requests older than 24h (called on-demand)."""
    cutoff = _now() - AUTO_REJECT_AFTER
    expired = CarpoolBooking.query.filter(
        CarpoolBooking.status == "PENDING",
        CarpoolBooking.created_at < cutoff,
    ).all()

    if not expired:
        return

    for b in expired:
        b.status = "REJECTED"
        b.status_updated_at = _now()

        passenger = b.passenger
        ride = b.ride_post

        # Email passenger (lux HTML + text fallback)
        try:
            text = (
                f"Your request for {ride.departure} → {ride.destination} at "
                f"{ride.departure_datetime.isoformat()} was auto-rejected because "
                f"the driver didn’t respond within 24 hours."
            )
            html = urbix_email_html(
                title="Request auto-rejected",
                subtitle="The driver did not respond within 24 hours.",
                badge="EXPIRED",
                rows=_ride_rows(ride, seats=b.seats_requested,
                                status="Rejected"),
                cta_text="Open My Rides",
                cta_url="",
                footer_note="UrbiX • This is an automated update",
            )
            send_email(
                passenger.email,
                "UrbiX: Ride request auto-rejected (no response)",
                text,
                html=html,
            )
        except Exception as e:
            print("[EMAIL] failed:", e)

    db.session.commit()


# --------------------------
# Public rides listing
# --------------------------
@ride_bp.get("")
def list_rides():
    auto_reject_expired_requests()

    departure = (request.args.get("departure") or "").strip()
    destination = (request.args.get("destination") or "").strip()
    date = (request.args.get("date") or "").strip()  # YYYY-MM-DD

    q = RidePost.query

    if departure:
        q = q.filter(RidePost.departure.ilike(f"%{departure}%"))
    if destination:
        q = q.filter(RidePost.destination.ilike(f"%{destination}%"))
    if date:
        try:
            day = datetime.strptime(date, "%Y-%m-%d").date()
            q = q.filter(db.func.date(RidePost.departure_datetime) == day)
        except ValueError:
            return fail("Invalid date format. Use YYYY-MM-DD.", 400)

    # Issue 9: filter by ride preferences
    if request.args.get("no_smoking") == "1":
        q = q.filter(RidePost.allow_smoking == False)
    if request.args.get("pets_ok") == "1":
        q = q.filter(RidePost.allow_pets == True)
    if request.args.get("music_ok") == "1":
        q = q.filter(RidePost.music_ok == True)

    # Default: only show OPEN rides unless caller asks for all
    if request.args.get("all_statuses") != "1":
        q = q.filter(RidePost.status == "OPEN")

    rides = q.order_by(RidePost.departure_datetime.asc()).limit(50).all()
    return ok([r.to_dict() for r in rides])


# --------------------------
# Create ride offer (driver)
# --------------------------
@ride_bp.post("")
@jwt_required()
def create_ride_offer():
    auto_reject_expired_requests()

    user = _current_user()
    if not user:
        return fail("User not found", 404)

    data = request.get_json(silent=True) or {}
    departure = (data.get("departure") or "").strip()
    destination = (data.get("destination") or "").strip()
    date = (data.get("date") or "").strip()
    time = (data.get("time") or "").strip()

    # Accept both camelCase + snake_case + legacy "seats"
    raw_seats = (
        data.get("seatsAvailable")
        if data.get("seatsAvailable") is not None
        else data.get("seats_available")
        if data.get("seats_available") is not None
        else data.get("seats")
    )
    seats = 1 if raw_seats is None else raw_seats

    if not departure or not destination or not date or not time:
        return fail("Missing required fields: departure, destination, date, time", 400)

    try:
        dt = parse_departure_datetime(date, time)
    except ValueError:
        return fail("Invalid date/time format", 400)

    # BUG 3: do not allow rides in the past
    if dt < _now():
        return fail("You cannot offer a ride in the past", 400)

    try:
        seats = int(seats)
        if seats < 1 or seats > 8:
            return fail("seatsAvailable must be between 1 and 8", 400)
    except (TypeError, ValueError):
        return fail("seatsAvailable must be a number", 400)

    # Issue 8: ride lifestyle preferences from request body
    rp = data.get("ridePreferences") or {}
    allow_smoking = bool(rp.get("allowSmoking", False))
    allow_pets    = bool(rp.get("allowPets", False))
    music_ok      = bool(rp.get("musicOk", True))
    chatty        = bool(rp.get("chatty", True))

    # Issue 1: optional meetup lat/lng
    meetup_lat = data.get("meetupLat")
    meetup_lng = data.get("meetupLng")
    if meetup_lat is not None:
        try:
            meetup_lat = float(meetup_lat)
        except (TypeError, ValueError):
            meetup_lat = None
    if meetup_lng is not None:
        try:
            meetup_lng = float(meetup_lng)
        except (TypeError, ValueError):
            meetup_lng = None

    raw_price = data.get("pricePerSeatCad")
    if raw_price is None:
        raw_price = data.get("price_per_seat_cad")
    price_per_seat_cad = None
    if raw_price is not None and raw_price != "":
        try:
            p = float(raw_price)
            if p < 0 or p > 999.99:
                return fail("pricePerSeatCad must be between 0 and 999.99", 400)
            if p > 0:
                price_per_seat_cad = round(p, 2)
        except (TypeError, ValueError):
            return fail("pricePerSeatCad must be a number", 400)

    ride = RidePost(
        creator=user,
        departure=departure,
        destination=destination,
        departure_datetime=dt,
        seats_available=seats,
        status="OPEN",
        allow_smoking=allow_smoking,
        allow_pets=allow_pets,
        music_ok=music_ok,
        chatty=chatty,
        meetup_lat=meetup_lat,
        meetup_lng=meetup_lng,
        price_per_seat_cad=price_per_seat_cad,
    )

    db.session.add(ride)
    db.session.commit()
    EventBus.publish("ride_created", user_id=user.id, metadata={"ride_id": ride.id, "departure": ride.departure, "destination": ride.destination})
    return ok(ride.to_dict(), 201)


# --------------------------
# Update ride (driver CRUD)
# --------------------------
@ride_bp.put("/<int:ride_id>")
@jwt_required()
def update_ride(ride_id: int):
    auto_reject_expired_requests()

    user = _current_user()
    if not user:
        return fail("User not found", 404)

    ride = RidePost.query.get(ride_id)
    if not ride:
        return fail("Ride not found", 404)

    if ride.creator_user_id != user.id:
        return fail("Not allowed", 403)

    data = request.get_json(silent=True) or {}

    if "departure" in data:
        ride.departure = (data["departure"] or "").strip()
    if "destination" in data:
        ride.destination = (data["destination"] or "").strip()

    # allow either (date,time) or departure_datetime ISO (we currently handle date/time)
    if "date" in data and "time" in data:
        try:
            new_dt = parse_departure_datetime(data["date"], data["time"])
        except ValueError:
            return fail("Invalid date/time format", 400)

        # BUG 3: do not allow setting to past
        if new_dt < _now():
            return fail("You cannot set a ride in the past", 400)

        ride.departure_datetime = new_dt

    # BUG 1: accept both camelCase + snake_case, and don't miss updates
    if "seatsAvailable" in data or "seats_available" in data:
        try:
            raw = data.get("seatsAvailable")
            if raw is None:
                raw = data.get("seats_available")

            new_seats = int(raw)
            if new_seats < 0 or new_seats > 8:
                return fail("seatsAvailable must be between 0 and 8", 400)
            ride.seats_available = new_seats
        except (TypeError, ValueError):
            return fail("seatsAvailable must be a number", 400)

    # status recompute
    if ride.seats_available <= 0:
        ride.status = "FULL"
    elif ride.status == "FULL":
        ride.status = "OPEN"

    if "pricePerSeatCad" in data or "price_per_seat_cad" in data:
        raw_price = data.get("pricePerSeatCad")
        if raw_price is None:
            raw_price = data.get("price_per_seat_cad")
        if raw_price is None or raw_price == "":
            ride.price_per_seat_cad = None
        else:
            try:
                p = float(raw_price)
                if p < 0 or p > 999.99:
                    return fail("pricePerSeatCad must be between 0 and 999.99", 400)
                ride.price_per_seat_cad = round(p, 2) if p > 0 else None
            except (TypeError, ValueError):
                return fail("pricePerSeatCad must be a number", 400)

    db.session.commit()
    return ok(ride.to_dict())


# --------------------------
# Delete ride (driver CRUD)
# --------------------------
@ride_bp.delete("/<int:ride_id>")
@jwt_required()
def delete_ride(ride_id: int):
    auto_reject_expired_requests()

    user = _current_user()
    if not user:
        return fail("User not found", 404)

    ride = RidePost.query.get(ride_id)
    if not ride:
        return fail("Ride not found", 404)

    if ride.creator_user_id != user.id:
        return fail("Not allowed", 403)

    # Optional: notify all pending/accepted passengers
    bookings = CarpoolBooking.query.filter_by(ride_post_id=ride.id).all()
    for b in bookings:
        if b.status in ("PENDING", "ACCEPTED", "AWAITING_PAYMENT"):
            try:
                text = (
                    f"The ride {ride.departure} → {ride.destination} at "
                    f"{ride.departure_datetime.isoformat()} was cancelled by the driver."
                )
                html = urbix_email_html(
                    title="Ride cancelled",
                    subtitle="The driver cancelled this ride offer.",
                    badge="CANCELLED",
                    rows=_ride_rows(
                        ride, seats=b.seats_requested, status="Cancelled"),
                    cta_text="Open My Rides",
                    cta_url="",
                    footer_note="UrbiX • We’ll help you find another ride soon",
                )
                send_email(
                    b.passenger.email,
                    "UrbiX: Ride cancelled",
                    text,
                    html=html,
                )
            except Exception as e:
                print("[EMAIL] failed:", e)

    db.session.delete(ride)
    db.session.commit()
    return ok({"deleted": True})


# --------------------------
# Passenger requests a ride
# --------------------------
@ride_bp.post("/<int:ride_id>/request")
@jwt_required()
def request_ride(ride_id: int):
    auto_reject_expired_requests()

    passenger = _current_user()
    if not passenger:
        return fail("User not found", 404)

    ride = RidePost.query.get(ride_id)
    if not ride:
        return fail("Ride not found", 404)

    if ride.status != "OPEN":
        return fail("Ride is not open for requests", 400)

    if ride.creator_user_id == passenger.id:
        return fail("You cannot request your own ride", 400)

    existing = CarpoolBooking.query.filter_by(
        ride_post_id=ride.id, passenger_user_id=passenger.id
    ).first()
    if existing and existing.status in ("PENDING", "ACCEPTED", "AWAITING_PAYMENT"):
        return fail("You already have a booking for this ride", 409)

    data = request.get_json(silent=True) or {}

    # accept both camelCase + snake_case
    raw_sr = (
        data.get("seatsRequested")
        if data.get("seatsRequested") is not None
        else data.get("seats_requested")
        if data.get("seats_requested") is not None
        else 1
    )

    try:
        seats_requested = int(raw_sr)
    except (TypeError, ValueError):
        return fail("seatsRequested must be a number", 400)

    if seats_requested < 1:
        return fail("seatsRequested must be >= 1", 400)
    if seats_requested > ride.seats_available:
        return fail("Not enough seats available", 400)

    booking = CarpoolBooking(
        ride_post=ride,
        passenger=passenger,
        seats_requested=seats_requested,
        status="PENDING",
        status_updated_at=_now(),
    )
    db.session.add(booking)
    db.session.commit()
    EventBus.publish("booking_created", user_id=passenger.id, metadata={"booking_id": booking.id, "ride_id": ride.id})

    # Email driver about the request
    try:
        text = (
            f"A user requested your ride {ride.departure} → {ride.destination} "
            f"at {ride.departure_datetime.isoformat()}.\n\n"
            f"Seats requested: {seats_requested}\n"
            f"Open UrbiX → My Rides to approve/reject."
        )
        html = urbix_email_html(
            title="New ride request",
            subtitle="Someone requested a seat on your ride. Review it in My Rides.",
            badge="ACTION NEEDED",
            rows=_ride_rows(ride, seats=seats_requested, status="Pending"),
            cta_text="Review requests",
            cta_url="#",  # To be replaced by our real url.
            footer_note="UrbiX • Quick approvals get faster matches",
        )
        send_email(
            ride.creator.email,
            "UrbiX: New ride request",
            text,
            html=html,
        )
    except Exception as e:
        print("[EMAIL] failed:", e)

    return ok(booking.to_dict(), 201)


# --------------------------
# Driver views requests for a ride
# --------------------------
@ride_bp.get("/<int:ride_id>/requests")
@jwt_required()
def list_requests_for_ride(ride_id: int):
    auto_reject_expired_requests()

    user = _current_user()
    if not user:
        return fail("User not found", 404)

    ride = RidePost.query.get(ride_id)
    if not ride:
        return fail("Ride not found", 404)

    if ride.creator_user_id != user.id:
        return fail("Not allowed", 403)

    bookings = CarpoolBooking.query.filter_by(ride_post_id=ride.id).order_by(
        CarpoolBooking.created_at.desc()
    ).all()
    return ok([b.to_dict() for b in bookings])


# --------------------------
# Driver approve / reject request
# --------------------------
@ride_bp.post("/requests/<int:booking_id>/approve")
@jwt_required()
def approve_request(booking_id: int):
    auto_reject_expired_requests()

    driver = _current_user()
    if not driver:
        return fail("User not found", 404)

    booking = CarpoolBooking.query.get(booking_id)
    if not booking:
        return fail("Request not found", 404)

    ride = booking.ride_post
    if ride.creator_user_id != driver.id:
        return fail("Not allowed", 403)

    if booking.status != "PENDING":
        return fail("Request is not pending", 400)

    if booking.seats_requested > ride.seats_available:
        return fail("Not enough seats available", 400)

    unit = ride.price_per_seat_cad or 0.0
    total_due = round(float(unit) * booking.seats_requested, 2)

    if total_due <= 0:
        booking.status = "ACCEPTED"
        booking.payment_status = "NONE"
        booking.amount_due_cad = None
        booking.status_updated_at = _now()
        ride.seats_available -= booking.seats_requested
        if ride.seats_available <= 0:
            ride.seats_available = 0
            ride.status = "FULL"
    else:
        booking.status = "AWAITING_PAYMENT"
        booking.payment_status = "PENDING"
        booking.amount_due_cad = total_due
        booking.status_updated_at = _now()

    db.session.commit()
    EventBus.publish("booking_approved", user_id=driver.id, metadata={"booking_id": booking.id, "ride_id": ride.id})

    # Email passenger
    try:
        if total_due <= 0:
            text = (
                f"Your request was approved for {ride.departure} → {ride.destination} "
                f"at {ride.departure_datetime.isoformat()}."
            )
            html = urbix_email_html(
                title="Request approved",
                subtitle="You're in — the driver approved your request.",
                badge="APPROVED",
                rows=_ride_rows(ride, seats=booking.seats_requested,
                                status="Accepted"),
                cta_text="Open My Rides",
                cta_url="",
                footer_note="UrbiX • Have a great ride",
            )
        else:
            text = (
                f"Your request was approved for {ride.departure} → {ride.destination}. "
                f"Complete payment of ${total_due:.2f} CAD in My Rides to confirm your seat."
            )
            html = urbix_email_html(
                title="Complete your payment",
                subtitle=f"The driver approved your request. Pay ${total_due:.2f} CAD in My Rides to confirm.",
                badge="PAYMENT DUE",
                rows=_ride_rows(ride, seats=booking.seats_requested,
                                status="Awaiting payment"),
                cta_text="Open My Rides",
                cta_url="",
                footer_note="UrbiX • Your seat is held until you pay",
            )
        send_email(
            booking.passenger.email,
            "UrbiX: Ride request approved",
            text,
            html=html,
        )
    except Exception as e:
        print("[EMAIL] failed:", e)

    return ok({"booking": booking.to_dict(), "ride": ride.to_dict()})


@ride_bp.post("/requests/<int:booking_id>/reject")
@jwt_required()
def reject_request(booking_id: int):
    auto_reject_expired_requests()

    driver = _current_user()
    if not driver:
        return fail("User not found", 404)

    booking = CarpoolBooking.query.get(booking_id)
    if not booking:
        return fail("Request not found", 404)

    ride = booking.ride_post
    if ride.creator_user_id != driver.id:
        return fail("Not allowed", 403)

    if booking.status not in ("PENDING", "AWAITING_PAYMENT"):
        return fail("Request cannot be rejected", 400)

    booking.status = "REJECTED"
    booking.payment_status = "NONE"
    booking.amount_due_cad = None
    booking.status_updated_at = _now()
    db.session.commit()
    EventBus.publish("booking_rejected", user_id=driver.id, metadata={"booking_id": booking.id, "ride_id": ride.id})

    try:
        text = (
            f"Your request was rejected for {ride.departure} → {ride.destination} "
            f"at {ride.departure_datetime.isoformat()}."
        )
        html = urbix_email_html(
            title="Request rejected",
            subtitle="The driver wasn’t able to accept this request.",
            badge="REJECTED",
            rows=_ride_rows(ride, seats=booking.seats_requested,
                            status="Rejected"),
            cta_text="Browse rides",
            cta_url="",
            footer_note="UrbiX • You’ll find another match",
        )
        send_email(
            booking.passenger.email,
            "UrbiX: Ride request rejected",
            text,
            html=html,
        )
    except Exception as e:
        print("[EMAIL] failed:", e)

    return ok(booking.to_dict())


# --------------------------
# Passenger: my bookings + cancel
# --------------------------
@ride_bp.get("/bookings/me")
@jwt_required()
def my_bookings():
    auto_reject_expired_requests()

    passenger = _current_user()
    if not passenger:
        return fail("User not found", 404)

    bookings = (
        CarpoolBooking.query.filter_by(passenger_user_id=passenger.id)
        .order_by(CarpoolBooking.created_at.desc())
        .all()
    )
    return ok([b.to_dict() for b in bookings])


# --------------------------
# Passenger: mock payment (replace with Stripe Checkout in production)
# --------------------------
@ride_bp.post("/bookings/<int:booking_id>/pay")
@jwt_required()
def pay_booking(booking_id: int):
    auto_reject_expired_requests()

    passenger = _current_user()
    if not passenger:
        return fail("User not found", 404)

    booking = CarpoolBooking.query.get(booking_id)
    if not booking:
        return fail("Booking not found", 404)

    if booking.passenger_user_id != passenger.id:
        return fail("Not allowed", 403)

    if booking.status != "AWAITING_PAYMENT":
        return fail("No payment is due for this booking", 400)
    if booking.payment_status != "PENDING":
        return fail("Invalid payment state", 400)

    ride = booking.ride_post
    if booking.seats_requested > ride.seats_available:
        return fail("Not enough seats available — ride may be full", 400)

    booking.status = "ACCEPTED"
    booking.payment_status = "PAID"
    booking.paid_at = _now()
    booking.status_updated_at = _now()
    ride.seats_available -= booking.seats_requested
    if ride.seats_available <= 0:
        ride.seats_available = 0
        ride.status = "FULL"

    db.session.commit()
    EventBus.publish(
        "carpool_payment_completed",
        user_id=passenger.id,
        metadata={
            "booking_id": booking.id,
            "ride_id": ride.id,
            "amount_cad": booking.amount_due_cad,
        },
    )

    return ok({"booking": booking.to_dict(), "ride": ride.to_dict()})


@ride_bp.delete("/requests/<int:booking_id>")
@jwt_required()
def cancel_request(booking_id: int):
    auto_reject_expired_requests()

    passenger = _current_user()
    if not passenger:
        return fail("User not found", 404)

    booking = CarpoolBooking.query.get(booking_id)
    if not booking:
        return fail("Request not found", 404)

    if booking.passenger_user_id != passenger.id:
        return fail("Not allowed", 403)

    if booking.status not in ("PENDING", "ACCEPTED", "AWAITING_PAYMENT"):
        return fail("Cannot cancel this request", 400)

    ride = booking.ride_post

    if booking.status == "ACCEPTED":
        ride.seats_available += booking.seats_requested
        if ride.seats_available > 0 and ride.status == "FULL":
            ride.status = "OPEN"
    # AWAITING_PAYMENT: seats were never reserved yet

    booking.status = "CANCELLED"
    booking.payment_status = "NONE"
    booking.amount_due_cad = None
    booking.status_updated_at = _now()
    db.session.commit()

    # Optional: email driver
    try:
        text = (
            f"A passenger cancelled their request for your ride "
            f"{ride.departure} → {ride.destination} at {ride.departure_datetime.isoformat()}."
        )
        html = urbix_email_html(
            title="Request cancelled",
            subtitle="A passenger cancelled their ride request.",
            badge="CANCELLED",
            rows=_ride_rows(ride, seats=booking.seats_requested,
                            status="Cancelled"),
            cta_text="Open My Rides",
            cta_url="",
            footer_note="UrbiX • Seats are now available again",
        )
        send_email(
            ride.creator.email,
            "UrbiX: Ride request cancelled",
            text,
            html=html,
        )
    except Exception as e:
        print("[EMAIL] failed:", e)

    return ok({"cancelled": True, "booking": booking.to_dict(), "ride": ride.to_dict()})


# --------------------------
# My Rides (for navbar)
# --------------------------
@ride_bp.get("/mine/offered")
@jwt_required()
def my_offered_rides():
    auto_reject_expired_requests()

    user = _current_user()
    if not user:
        return fail("User not found", 404)

    rides = RidePost.query.filter_by(creator_user_id=user.id).order_by(
        RidePost.departure_datetime.desc()
    ).all()

    # BUG 2: include request count so UI can show it without expanding
    out = []
    for r in rides:
        d = r.to_dict()
        d["requests_count"] = CarpoolBooking.query.filter_by(
            ride_post_id=r.id).count()
        out.append(d)

    return ok(out)


@ride_bp.get("/mine/requested")
@jwt_required()
def my_requested_rides():
    auto_reject_expired_requests()

    user = _current_user()
    if not user:
        return fail("User not found", 404)

    bookings = CarpoolBooking.query.filter_by(passenger_user_id=user.id).order_by(
        CarpoolBooking.created_at.desc()
    ).all()

    data = []
    for b in bookings:
        ride = b.ride_post
        data.append({
            "booking": b.to_dict(),
            "ride": ride.to_dict(),
        })

    return ok(data)
