from datetime import datetime
from ..extensions import db


class Trip(db.Model):
    __tablename__ = "trips"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "carpool", "transit", "bike", "walking", "car"
    mode = db.Column(db.String(30), nullable=False)

    distance_km = db.Column(db.Float, nullable=False)

    # Optional: human-readable note e.g. "Rode from McGill to Plateau"
    note = db.Column(db.String(255), nullable=True)

    # If this trip came from a confirmed carpool booking, link it
    booking_id = db.Column(
        db.Integer,
        db.ForeignKey("carpool_bookings.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = db.relationship("User", backref=db.backref("trips", lazy=True))

    def to_dict(self):
        return {
            "id":          self.id,
            "mode":        self.mode,
            "distance_km": self.distance_km,
            "note":        self.note,
            "booking_id":  self.booking_id,
            "created_at":  self.created_at.isoformat(),
        }
