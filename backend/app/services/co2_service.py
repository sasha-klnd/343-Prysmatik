"""
CO2 Calculator Service — Strategy Pattern
==========================================
Design Pattern: Strategy (GoF Behavioral)

Problem solved:
    CO2 emissions per trip vary by transport mode (car, carpool, transit, bike,
    walking).  Without the Strategy pattern, a single function would use a long
    if/elif chain to pick the right formula, making it hard to add new modes
    and impossible to swap algorithms at runtime.

Solution:
    Each transport mode encapsulates its calculation in a dedicated Strategy
    class that implements the CO2Strategy interface.  CO2Calculator selects
    the right strategy by mode key and delegates the computation.

Consequence of NOT using this pattern:
    A monolithic calculator function would violate the Open–Closed Principle:
    every new mode or rule change would require modifying the same function,
    risking regressions and making unit-testing individual formulas impossible.

Constants (Issue 11 — spec):
    Source: ADEME (Agence de la transition écologique) + Transport Canada data
    - Car solo:     0.192 kg CO₂e/km  (average gasoline passenger vehicle)
    - Transit:      0.041 kg CO₂e/km  (bus+metro weighted average, Montreal STM)
    - Bixi/bike:    0.000 kg CO₂e/km  (zero direct emissions)
    - Walking:      0.000 kg CO₂e/km
    - Carpool:      car CO₂ divided by number of occupants, compared to solo baseline
"""

from __future__ import annotations
from abc import ABC, abstractmethod


# ──────────────────────────────────────────────────────────────────────────────
# Abstract Strategy
# ──────────────────────────────────────────────────────────────────────────────

class CO2Strategy(ABC):
    """Interface for all CO2 calculation strategies."""

    @abstractmethod
    def calculate(self, distance_km: float, **kwargs) -> float:
        """
        Return kg of CO₂-equivalent emitted for this trip.

        :param distance_km: Trip distance in kilometres.
        :param kwargs:       Mode-specific parameters (e.g. ``occupants``).
        :returns:            CO₂ in kg (≥ 0).
        """
        ...

    @property
    @abstractmethod
    def mode_name(self) -> str:
        """Human-readable mode label."""
        ...


# ──────────────────────────────────────────────────────────────────────────────
# Concrete Strategies
# ──────────────────────────────────────────────────────────────────────────────

class CarCO2Strategy(CO2Strategy):
    """Solo gasoline passenger vehicle."""

    CO2_PER_KM = 0.192  # kg CO₂e / km

    @property
    def mode_name(self) -> str:
        return "car"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return round(distance_km * self.CO2_PER_KM, 4)


class CarpoolCO2Strategy(CO2Strategy):
    """
    Shared ride — same vehicle emissions but split across occupants.
    CO₂ per passenger = (total vehicle CO₂) / occupants.
    """

    CO2_PER_KM = 0.192  # same vehicle emissions as a car

    @property
    def mode_name(self) -> str:
        return "carpool"

    def calculate(self, distance_km: float, occupants: int = 2, **kwargs) -> float:
        occupants = max(1, int(occupants))
        total_vehicle_co2 = distance_km * self.CO2_PER_KM
        return round(total_vehicle_co2 / occupants, 4)


class TransitCO2Strategy(CO2Strategy):
    """Public transit (bus + metro weighted average, STM Montréal)."""

    CO2_PER_KM = 0.041  # kg CO₂e / km

    @property
    def mode_name(self) -> str:
        return "transit"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return round(distance_km * self.CO2_PER_KM, 4)


class BikeCO2Strategy(CO2Strategy):
    """BIXI or personal bike — zero direct emissions."""

    @property
    def mode_name(self) -> str:
        return "bike"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return 0.0


class WalkingCO2Strategy(CO2Strategy):
    """Walking — zero direct emissions."""

    @property
    def mode_name(self) -> str:
        return "walking"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Context — CO2Calculator
# ──────────────────────────────────────────────────────────────────────────────

class CO2Calculator:
    """
    Selects the right CO2Strategy by mode name and delegates computation.

    Supported modes: "car", "carpool", "transit", "bike", "walking"
    """

    _strategies: dict[str, CO2Strategy] = {
        "car":      CarCO2Strategy(),
        "carpool":  CarpoolCO2Strategy(),
        "transit":  TransitCO2Strategy(),
        "bike":     BikeCO2Strategy(),
        "walking":  WalkingCO2Strategy(),
    }

    @classmethod
    def calculate(cls, mode: str, distance_km: float, **kwargs) -> float:
        """
        Compute CO₂ for a trip.

        :param mode:        Transport mode key.
        :param distance_km: Distance in km.
        :param kwargs:      Passed to the strategy (e.g. ``occupants=3``).
        :raises ValueError: If mode is unknown.
        """
        strategy = cls._strategies.get(mode.lower())
        if strategy is None:
            raise ValueError(
                f"Unknown transport mode '{mode}'. "
                f"Supported: {list(cls._strategies)}"
            )
        return strategy.calculate(distance_km, **kwargs)

    @classmethod
    def co2_saved_vs_car(cls, mode: str, distance_km: float, **kwargs) -> float:
        """
        CO₂ saved compared to driving solo.
        A positive value means the chosen mode emits less than a solo car trip.
        """
        car_co2 = cls.calculate("car", distance_km)
        mode_co2 = cls.calculate(mode, distance_km, **kwargs)
        return round(car_co2 - mode_co2, 4)

    @classmethod
    def supported_modes(cls) -> list[str]:
        return list(cls._strategies)
