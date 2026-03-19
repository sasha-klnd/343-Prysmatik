"""
Cost Calculator Service — Strategy Pattern
==========================================
Design Pattern: Strategy (GoF Behavioral)  [same pattern as CO2Calculator]

Problem solved:
    Pricing logic differs dramatically by transport mode: STM charges a flat
    fare, Bixi charges by membership/duration, carpools split fuel costs,
    and walking/cycling are free.  A single function cannot accommodate these
    without becoming an unmaintainable if/elif block.

Solution:
    Each pricing model is a separate CostStrategy subclass.  CostCalculator
    selects the right strategy at runtime without knowing which concrete class
    it is using, fully respecting the Open–Closed Principle.

Constants (Issue 11 — spec):
    All costs in CAD:
    - Car:          $0.18 / km   (avg fuel + depreciation, CAA 2024 estimate)
    - Carpool:      driver cost split evenly across occupants
    - Transit (STM): $3.75 flat fare per trip (2024 adult single fare)
    - Bixi:         $7.25 / day pass (amortised; first 45 min free per trip)
                    $1.25 / 30-min extra after free window
    - Walking:      $0.00
"""

from __future__ import annotations
from abc import ABC, abstractmethod


# ──────────────────────────────────────────────────────────────────────────────
# Abstract Strategy
# ──────────────────────────────────────────────────────────────────────────────

class CostStrategy(ABC):
    """Interface for all cost calculation strategies."""

    @abstractmethod
    def calculate(self, distance_km: float, **kwargs) -> float:
        """
        Return cost in CAD for this trip.

        :param distance_km: Trip distance in kilometres.
        :param kwargs:       Mode-specific parameters.
        :returns:            Cost in CAD (≥ 0).
        """
        ...

    @property
    @abstractmethod
    def mode_name(self) -> str: ...


# ──────────────────────────────────────────────────────────────────────────────
# Concrete Strategies
# ──────────────────────────────────────────────────────────────────────────────

class CarCostStrategy(CostStrategy):
    """Solo car — fuel + depreciation per km (CAA 2024)."""

    COST_PER_KM = 0.18  # CAD / km

    @property
    def mode_name(self) -> str:
        return "car"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return round(distance_km * self.COST_PER_KM, 2)


class CarpoolCostStrategy(CostStrategy):
    """
    Carpool — total vehicle cost split across occupants.
    Driver and passengers each pay an equal share of the fuel/depreciation.
    """

    COST_PER_KM = 0.18  # same as solo car (driver pays for vehicle)

    @property
    def mode_name(self) -> str:
        return "carpool"

    def calculate(self, distance_km: float, occupants: int = 2, **kwargs) -> float:
        occupants = max(1, int(occupants))
        total_vehicle_cost = distance_km * self.COST_PER_KM
        per_person = total_vehicle_cost / occupants
        return round(per_person, 2)


class TransitCostStrategy(CostStrategy):
    """
    STM public transit — flat single-fare per trip (2024 adult fare).
    Does not scale with distance (Montréal STM is flat-rate).
    """

    FLAT_FARE_CAD = 3.75

    @property
    def mode_name(self) -> str:
        return "transit"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return self.FLAT_FARE_CAD


class BikeCostStrategy(CostStrategy):
    """
    Bixi — daily pass model.
    First 45 min of each trip is included in the day pass ($7.25).
    Average cycling speed ≈ 15 km/h → 45 min covers ≈ 11.25 km for free.
    Trips longer than 45 min incur $1.25 / extra 30 min (rounded up).
    """

    DAY_PASS_CAD = 7.25
    FREE_KM_THRESHOLD = 11.25      # ~ 45 min at 15 km/h
    CYCLING_SPEED_KMH = 15.0
    EXTRA_BLOCK_MINUTES = 30
    EXTRA_BLOCK_COST_CAD = 1.25

    @property
    def mode_name(self) -> str:
        return "bike"

    def calculate(self, distance_km: float, **kwargs) -> float:
        import math
        duration_min = (distance_km / self.CYCLING_SPEED_KMH) * 60
        free_min = 45.0
        if duration_min <= free_min:
            return self.DAY_PASS_CAD
        extra_min = duration_min - free_min
        extra_blocks = math.ceil(extra_min / self.EXTRA_BLOCK_MINUTES)
        total = self.DAY_PASS_CAD + extra_blocks * self.EXTRA_BLOCK_COST_CAD
        return round(total, 2)


class WalkingCostStrategy(CostStrategy):
    """Walking — free."""

    @property
    def mode_name(self) -> str:
        return "walking"

    def calculate(self, distance_km: float, **kwargs) -> float:
        return 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Context — CostCalculator
# ──────────────────────────────────────────────────────────────────────────────

class CostCalculator:
    """
    Selects the right CostStrategy by mode name and delegates computation.
    """

    _strategies: dict[str, CostStrategy] = {
        "car":      CarCostStrategy(),
        "carpool":  CarpoolCostStrategy(),
        "transit":  TransitCostStrategy(),
        "bike":     BikeCostStrategy(),
        "walking":  WalkingCostStrategy(),
    }

    @classmethod
    def calculate(cls, mode: str, distance_km: float, **kwargs) -> float:
        """
        Compute cost for a trip.

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
    def savings_vs_car(cls, mode: str, distance_km: float, **kwargs) -> float:
        """Money saved compared to driving solo."""
        car_cost = cls.calculate("car", distance_km)
        mode_cost = cls.calculate(mode, distance_km, **kwargs)
        return round(car_cost - mode_cost, 2)

    @classmethod
    def supported_modes(cls) -> list[str]:
        return list(cls._strategies)
