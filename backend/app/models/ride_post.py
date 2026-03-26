from datetime import datetime
from ..extensions import db


class RidePost(db.Model):
    __tablename__ = "ride_posts"

    id = db.Column(db.Integer, primary_key=True)

    creator_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    departure    = db.Column(db.String(255), nullable=False)
    destination  = db.Column(db.String(255), nullable=False)
    departure_datetime = db.Column(db.DateTime, nullable=False)

    seats_available = db.Column(db.Integer, nullable=False, default=1)

    # Optional contribution per seat (CAD). Null or 0 = free ride.
    price_per_seat_cad = db.Column(db.Float, nullable=True)

    # Issue 1: meetup point lat/lng (optional, for map pin)
    meetup_lat  = db.Column(db.Float, nullable=True)
    meetup_lng  = db.Column(db.Float, nullable=True)

    # Issue 8: driver's ride preferences (stored on the ride offer)
    allow_smoking = db.Column(db.Boolean, default=False, nullable=False)
    allow_pets    = db.Column(db.Boolean, default=False, nullable=False)
    music_ok      = db.Column(db.Boolean, default=True,  nullable=False)
    chatty        = db.Column(db.Boolean, default=True,  nullable=False)

    # OPEN/FULL/CANCELLED/COMPLETED
    status = db.Column(db.String(30), nullable=False, default="OPEN")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    creator  = db.relationship("User", back_populates="ride_posts")
    bookings = db.relationship(
        "CarpoolBooking",
        back_populates="ride_post",
        cascade="all,delete-orphan",
    )

    def to_dict(self):
        return {
            "id":                self.id,
            "departure":         self.departure,
            "destination":       self.destination,
            "departure_datetime": self.departure_datetime.isoformat(),
            "seats_available":   self.seats_available,
            "price_per_seat_cad": self.price_per_seat_cad,
            "status":            self.status,
            "creator":           self.creator.to_safe_dict() if self.creator else None,
            # meetup point
            "meetup_lat":        self.meetup_lat,
            "meetup_lng":        self.meetup_lng,
            # ride preferences
            "ridePreferences": {
                "allowSmoking": self.allow_smoking,
                "allowPets":    self.allow_pets,
                "musicOk":      self.music_ok,
                "chatty":       self.chatty,
            },
        }
