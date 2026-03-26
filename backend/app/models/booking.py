from datetime import datetime
from ..extensions import db


class CarpoolBooking(db.Model):
    __tablename__ = "carpool_bookings"

    id = db.Column(db.Integer, primary_key=True)

    ride_post_id = db.Column(
        db.Integer,
        db.ForeignKey("ride_posts.id"),
        nullable=False,
        index=True,
    )
    passenger_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    seats_requested = db.Column(db.Integer, default=1, nullable=False)

    # PENDING / AWAITING_PAYMENT / ACCEPTED / REJECTED / CANCELLED
    status = db.Column(db.String(30), default="PENDING", nullable=False)

    status_updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False)

    # NONE until driver approves a paid ride → PENDING → PAID (mock or Stripe later)
    payment_status = db.Column(db.String(30), default="NONE", nullable=False)
    amount_due_cad = db.Column(db.Float, nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)

    matched_score = db.Column(db.Float, nullable=True)

    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False)

    ride_post = db.relationship("RidePost", back_populates="bookings")
    passenger = db.relationship("User", back_populates="bookings")

    def to_dict(self):
        return {
            "id": self.id,
            "ride_post_id": self.ride_post_id,
            "passenger": self.passenger.to_safe_dict() if self.passenger else None,
            "seats_requested": self.seats_requested,
            "status": self.status,
            "payment_status": self.payment_status,
            "amount_due_cad": self.amount_due_cad,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "matched_score": self.matched_score,
            "created_at": self.created_at.isoformat(),
        }
