# backend/app/models/user.py
from datetime import datetime
from ..extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False)

    preferences = db.relationship(
        "UserPreferences", back_populates="user", uselist=False, cascade="all,delete-orphan")
    ride_posts = db.relationship(
        "RidePost", back_populates="creator", cascade="all,delete-orphan")
    bookings = db.relationship(
        "CarpoolBooking", back_populates="passenger", cascade="all,delete-orphan")

    def to_safe_dict(self):
        """Use this when showing another user."""
        return {
            "id": self.id,
            "name": self.full_name,
            "created_at": self.created_at.isoformat(),
        }

    def to_public_dict(self):
        """Use this ONLY for 'me' endpoints."""
        return {
            "id": self.id,
            "name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "created_at": self.created_at.isoformat(),
        }
