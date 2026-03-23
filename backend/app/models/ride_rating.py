"""
RideRating model — stores driver ratings left by passengers after a completed ride.
One rating per passenger per booking. Driver rated on a 1–5 star scale.
"""
from datetime import datetime
from ..extensions import db


class RideRating(db.Model):
    __tablename__ = "ride_ratings"

    id = db.Column(db.Integer, primary_key=True)

    booking_id = db.Column(
        db.Integer,
        db.ForeignKey("carpool_bookings.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    # The passenger who is leaving the rating
    rater_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # The driver being rated
    rated_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    stars   = db.Column(db.Integer, nullable=False)   # 1–5
    comment = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    booking = db.relationship("CarpoolBooking", backref=db.backref("rating", uselist=False))

    def to_dict(self):
        return {
            "id":            self.id,
            "booking_id":    self.booking_id,
            "rater_id":      self.rater_id,
            "rated_user_id": self.rated_user_id,
            "stars":         self.stars,
            "comment":       self.comment,
            "created_at":    self.created_at.isoformat(),
        }
