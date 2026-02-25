from datetime import datetime
from ..extensions import db


class UserPreferences(db.Model):
    __tablename__ = "user_preferences"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey(
        "users.id"), nullable=False, unique=True, index=True)

    max_walking_time = db.Column(
        db.Integer, default=15, nullable=False)      # minutes
    budget_sensitivity = db.Column(
        db.Integer, default=50, nullable=False)    # 0-100 slider in UI
    use_by_default = db.Column(db.Boolean, default=True, nullable=False)

    # preferredModes (matches your UI booleans)
    prefer_transit = db.Column(db.Boolean, default=True, nullable=False)
    prefer_bike = db.Column(db.Boolean, default=True, nullable=False)
    prefer_carpool = db.Column(db.Boolean, default=False, nullable=False)
    prefer_driving = db.Column(db.Boolean, default=False, nullable=False)
    prefer_walking = db.Column(db.Boolean, default=True, nullable=False)

    # accessibility (matches your UI booleans)
    wheelchair_accessible = db.Column(
        db.Boolean, default=False, nullable=False)
    elevator_required = db.Column(db.Boolean, default=False, nullable=False)
    avoid_stairs = db.Column(db.Boolean, default=False, nullable=False)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    user = db.relationship("User", back_populates="preferences")

    def to_dict(self):
        return {
            "maxWalkingTime": self.max_walking_time,
            "budgetSensitivity": self.budget_sensitivity,
            "useByDefault": self.use_by_default,
            "preferredModes": {
                "transit": self.prefer_transit,
                "bike": self.prefer_bike,
                "carpool": self.prefer_carpool,
                "driving": self.prefer_driving,
                "walking": self.prefer_walking,
            },
            "accessibility": {
                "wheelchairAccessible": self.wheelchair_accessible,
                "elevatorRequired": self.elevator_required,
                "avoidStairs": self.avoid_stairs,
            },
        }
