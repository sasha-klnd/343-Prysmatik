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

    departure = db.Column(db.String(255), nullable=False)
    destination = db.Column(db.String(255), nullable=False)
    departure_datetime = db.Column(db.DateTime, nullable=False)

    seats_available = db.Column(db.Integer, nullable=False, default=1)

    # OPEN/FULL/CANCELLED/COMPLETED
    status = db.Column(db.String(30), nullable=False, default="OPEN")
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False)

    creator = db.relationship("User", back_populates="ride_posts")
    bookings = db.relationship(
        "CarpoolBooking",
        back_populates="ride_post",
        cascade="all,delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "departure": self.departure,
            "destination": self.destination,
            "departure_datetime": self.departure_datetime.isoformat(),
            "seats_available": self.seats_available,
            "status": self.status,
            "creator": self.creator.to_safe_dict() if self.creator else None,
        }
