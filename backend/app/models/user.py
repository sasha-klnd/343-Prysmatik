from datetime import datetime
from ..extensions import db


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    full_name     = db.Column(db.String(120), nullable=False)
    email         = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone         = db.Column(db.String(30), nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Email verification
    is_verified         = db.Column(db.Boolean, default=False, nullable=False)
    verification_token  = db.Column(db.String(64), nullable=True, unique=True, index=True)

    # Push notifications (Firebase Cloud Messaging device token)
    fcm_token = db.Column(db.String(255), nullable=True)

    # Average rating as a driver (updated on every new rating)
    avg_driver_rating  = db.Column(db.Float, nullable=True)
    total_ratings      = db.Column(db.Integer, default=0, nullable=False)

    preferences = db.relationship(
        "UserPreferences", back_populates="user", uselist=False, cascade="all,delete-orphan")
    ride_posts = db.relationship(
        "RidePost", back_populates="creator", cascade="all,delete-orphan")
    bookings = db.relationship(
        "CarpoolBooking", back_populates="passenger", cascade="all,delete-orphan")
    ratings_given = db.relationship(
        "RideRating", foreign_keys="RideRating.rater_id", backref="rater", lazy=True)
    ratings_received = db.relationship(
        "RideRating", foreign_keys="RideRating.rated_user_id", backref="rated_user", lazy=True)

    def to_safe_dict(self):
        """Use this when showing another user — includes public rating."""
        return {
            "id":               self.id,
            "name":             self.full_name,
            "created_at":       self.created_at.isoformat(),
            "avg_driver_rating": self.avg_driver_rating,
            "total_ratings":    self.total_ratings,
        }

    def to_public_dict(self):
        """Use this ONLY for 'me' endpoints."""
        return {
            "id":           self.id,
            "name":         self.full_name,
            "email":        self.email,
            "phone":        self.phone,
            "created_at":   self.created_at.isoformat(),
            "is_verified":  getattr(self, "is_verified", True),  # True = no banner before migration runs
            "avg_driver_rating": self.avg_driver_rating,
            "total_ratings": self.total_ratings,
        }
