"""
Observer Pattern — Analytics Event Bus
======================================
Design Pattern: Observer (GoF Behavioral)

Problem solved:
    Ride/booking controllers need to record analytics events without being
    coupled to the analytics storage layer.  Without this pattern, every
    controller would directly import and call DB-write code, making it
    impossible to add new analytics sinks (e.g. a metrics server, a message
    queue) without touching every controller.

Solution:
    EventBus acts as the Subject.  Any number of AnalyticsObserver instances
    can subscribe.  When a domain action fires ``EventBus.publish(...)``,
    every subscribed observer is notified — controllers stay decoupled from
    the analytics implementation.

Consequence of NOT using this pattern:
    All analytics writes would be scattered across controllers with tight
    coupling.  Adding a second analytics destination (e.g. sending metrics
    to an external service) would require modifying every controller,
    violating the Open–Closed Principle.
"""

from __future__ import annotations
import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Abstract Observer
# ──────────────────────────────────────────────────────────────────────────────

class AnalyticsObserver(ABC):
    """Abstract base for all analytics observers."""

    @abstractmethod
    def on_event(
        self,
        event_type: str,
        user_id: int | None = None,
        metadata: dict | None = None,
    ) -> None: ...


# ──────────────────────────────────────────────────────────────────────────────
# Concrete Observer — writes to the analytics_events table
# ──────────────────────────────────────────────────────────────────────────────

class DBAnalyticsObserver(AnalyticsObserver):
    """
    Persists every event to the analytics_events table inside the current
    SQLAlchemy session.  The caller is responsible for committing.
    """

    def on_event(
        self,
        event_type: str,
        user_id: int | None = None,
        metadata: dict | None = None,
    ) -> None:
        # Import here to avoid circular imports at module load time
        from ..extensions import db
        from ..models.analytics_event import AnalyticsEvent

        try:
            event = AnalyticsEvent(
                event_type=event_type,
                user_id=user_id,
                event_metadata=json.dumps(metadata or {}),
                created_at=datetime.utcnow(),
            )
            db.session.add(event)
            # NOTE: caller commits the session; we intentionally do not commit here
            # so that the event is rolled back if the surrounding transaction fails.
        except Exception as exc:  # pragma: no cover
            logger.warning("DBAnalyticsObserver failed to record event: %s", exc)


# ──────────────────────────────────────────────────────────────────────────────
# Concrete Observer — stdout logger (useful for debugging / dev)
# ──────────────────────────────────────────────────────────────────────────────

class LoggingAnalyticsObserver(AnalyticsObserver):
    """Logs events to the Python logger (non-persistent, useful in dev)."""

    def on_event(
        self,
        event_type: str,
        user_id: int | None = None,
        metadata: dict | None = None,
    ) -> None:
        logger.info(
            "[ANALYTICS] event=%s user_id=%s metadata=%s",
            event_type,
            user_id,
            metadata,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Subject — EventBus (singleton-style class with class-level state)
# ──────────────────────────────────────────────────────────────────────────────

class EventBus:
    """
    Central publish/subscribe hub.

    Usage::

        # At app startup — register observers once
        EventBus.subscribe(DBAnalyticsObserver())

        # In a controller — publish an event
        EventBus.publish("ride_created", user_id=user.id, metadata={"ride_id": ride.id})
    """

    _observers: list[AnalyticsObserver] = []

    @classmethod
    def subscribe(cls, observer: AnalyticsObserver) -> None:
        """Register an observer."""
        if observer not in cls._observers:
            cls._observers.append(observer)

    @classmethod
    def unsubscribe(cls, observer: AnalyticsObserver) -> None:
        """Remove an observer (useful in tests)."""
        cls._observers = [o for o in cls._observers if o is not observer]

    @classmethod
    def clear(cls) -> None:
        """Remove all observers (useful in tests)."""
        cls._observers = []

    @classmethod
    def publish(
        cls,
        event_type: str,
        user_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Notify all subscribed observers of an event."""
        for observer in cls._observers:
            try:
                observer.on_event(event_type, user_id=user_id, metadata=metadata)
            except Exception as exc:  # pragma: no cover
                logger.warning("Observer %s raised: %s", observer, exc)
