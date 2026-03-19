"""
Mobility Service Factory — Factory Pattern
==========================================
Design Pattern: Factory / Abstract Factory (GoF Creational)

Problem solved:
    The AI planner and future route-planning modules need to query different
    mobility services (Bixi, Transit, Carpool) through a uniform interface.
    Without a Factory, every caller would directly instantiate concrete classes,
    creating tight coupling and making it impossible to add new services
    (e.g., electric scooters) without modifying every caller.

Solution:
    MobilityServiceFactory exposes a single ``create(service_type)`` class method.
    Callers request a service by name string; the factory returns the appropriate
    concrete MobilityService subclass.  Callers depend only on the abstract
    interface, never on concrete types.

Consequence of NOT using this pattern:
    Adding a new mobility service (e.g., "e-scooter") would require modifying
    every piece of code that instantiates mobility services.  The Factory
    isolates this concern: only the factory itself needs updating, respecting
    the Open–Closed Principle.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any


# ──────────────────────────────────────────────────────────────────────────────
# Abstract Product
# ──────────────────────────────────────────────────────────────────────────────

class MobilityService(ABC):
    """
    Common interface that all mobility-service implementations must satisfy.
    """

    @property
    @abstractmethod
    def service_type(self) -> str:
        """Short identifier, e.g. 'bixi', 'transit', 'carpool'."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable name for UI display."""
        ...

    @abstractmethod
    def get_info(self) -> dict[str, Any]:
        """Return static info / metadata about this service."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if the service is currently reachable/enabled."""
        ...


# ──────────────────────────────────────────────────────────────────────────────
# Concrete Products
# ──────────────────────────────────────────────────────────────────────────────

class BixiMobilityService(MobilityService):
    """Wraps the BixiService singleton to conform to the MobilityService interface."""

    @property
    def service_type(self) -> str:
        return "bixi"

    @property
    def display_name(self) -> str:
        return "BIXI Montréal"

    def get_info(self) -> dict[str, Any]:
        from .bixi_service import BixiService
        svc = BixiService()
        stations = svc.get_stations()
        total_bikes = sum(s.get("num_bikes_available", 0) for s in stations)
        return {
            "service_type": self.service_type,
            "display_name": self.display_name,
            "station_count": len(stations),
            "total_bikes_available": total_bikes,
            "last_updated": svc.last_updated,
            "is_fallback": svc.is_using_fallback,
        }

    def is_available(self) -> bool:
        try:
            from .bixi_service import BixiService
            BixiService().get_stations()
            return True
        except Exception:
            return False


class TransitMobilityService(MobilityService):
    """Represents the STM (Société de transport de Montréal) transit system."""

    STM_URL = "https://www.stm.info"

    @property
    def service_type(self) -> str:
        return "transit"

    @property
    def display_name(self) -> str:
        return "STM — Société de transport de Montréal"

    def get_info(self) -> dict[str, Any]:
        return {
            "service_type": self.service_type,
            "display_name": self.display_name,
            "external_url": self.STM_URL,
            "fare_cad": 3.75,
            "lines": {
                "metro": ["Ligne Verte (1)", "Ligne Orange (2)", "Ligne Jaune (4)", "Ligne Bleue (5)"],
                "bus": "400+ routes across the island"
            },
            "description": (
                "Montréal's public transit network operated by the STM, "
                "consisting of 69 metro stations and over 400 bus lines."
            ),
        }

    def is_available(self) -> bool:
        return True  # static info is always available


class CarpoolMobilityService(MobilityService):
    """Represents the in-app carpool feature."""

    @property
    def service_type(self) -> str:
        return "carpool"

    @property
    def display_name(self) -> str:
        return "UrbiX Covoiturage"

    def get_info(self) -> dict[str, Any]:
        # Pull live stats from DB
        try:
            from ..models.ride_post import RidePost
            open_rides = RidePost.query.filter_by(status="OPEN").count()
        except Exception:
            open_rides = None

        return {
            "service_type": self.service_type,
            "display_name": self.display_name,
            "open_rides": open_rides,
            "description": "Peer-to-peer ride sharing managed directly within UrbiX.",
        }

    def is_available(self) -> bool:
        return True


class WalkingMobilityService(MobilityService):
    """Pedestrian / walking service (always available, zero cost)."""

    @property
    def service_type(self) -> str:
        return "walking"

    @property
    def display_name(self) -> str:
        return "Walking"

    def get_info(self) -> dict[str, Any]:
        return {
            "service_type": self.service_type,
            "display_name": self.display_name,
            "cost_cad": 0.0,
            "co2_kg_per_km": 0.0,
        }

    def is_available(self) -> bool:
        return True


# ──────────────────────────────────────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────────────────────────────────────

class MobilityServiceFactory:
    """
    Factory that creates MobilityService instances by service-type key.

    Usage::

        svc = MobilityServiceFactory.create("bixi")
        info = svc.get_info()

        all_services = MobilityServiceFactory.create_all()
    """

    _registry: dict[str, type[MobilityService]] = {
        "bixi":     BixiMobilityService,
        "transit":  TransitMobilityService,
        "carpool":  CarpoolMobilityService,
        "walking":  WalkingMobilityService,
    }

    @classmethod
    def create(cls, service_type: str) -> MobilityService:
        """
        Instantiate and return the MobilityService for the given type.

        :raises ValueError: If the service_type is not registered.
        """
        klass = cls._registry.get(service_type.lower())
        if klass is None:
            raise ValueError(
                f"Unknown mobility service '{service_type}'. "
                f"Available: {cls.available_types()}"
            )
        return klass()

    @classmethod
    def create_all(cls) -> list[MobilityService]:
        """Return one instance of every registered service."""
        return [klass() for klass in cls._registry.values()]

    @classmethod
    def available_types(cls) -> list[str]:
        return list(cls._registry)

    @classmethod
    def register(cls, service_type: str, klass: type[MobilityService]) -> None:
        """
        Register a new mobility service type at runtime.
        This allows extending the system without modifying the factory itself.
        """
        cls._registry[service_type.lower()] = klass
