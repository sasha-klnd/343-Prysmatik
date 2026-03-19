"""
AnalyticsEvent model — stores key system events for admin analytics.
Written to by the Observer pattern (see services/event_bus.py).
"""
import json
from datetime import datetime
from ..extensions import db


class AnalyticsEvent(db.Model):
    __tablename__ = "analytics_events"

    id = db.Column(db.Integer, primary_key=True)

    # e.g. "ride_created", "booking_created", "booking_approved",
    #       "booking_rejected", "booking_cancelled", "user_registered"
    event_type = db.Column(db.String(60), nullable=False, index=True)

    # nullable: system-level events may not have a user
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # JSON blob — arbitrary per-event metadata (ride_id, mode, etc.)
    event_metadata = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    # ── helpers ──────────────────────────────────────────────────────────
    def get_metadata(self) -> dict:
        if not self.event_metadata:
            return {}
        try:
            return json.loads(self.event_metadata)
        except (ValueError, TypeError):
            return {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "user_id": self.user_id,
            "metadata": self.get_metadata(),
            "created_at": self.created_at.isoformat(),
        }
