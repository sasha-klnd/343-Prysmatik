"""
Bixi Station Service — Singleton Pattern
========================================
Design Pattern: Singleton (GoF Creational)

Problem solved:
    Every HTTP request that needs Bixi station data could independently call
    the Bixi GBFS API, causing unnecessary network load, rate-limiting risk,
    and slow response times.  We need exactly ONE shared service instance that
    owns the cache.

Solution:
    BixiService uses ``__new__`` to guarantee a single instance is created
    for the lifetime of the process.  The instance caches station data and
    exposes it to all controllers.  A configurable TTL (default 5 min) ensures
    freshness without hammering the external API.

Consequence of NOT using this pattern:
    Without a Singleton, every API call would spawn a new service object with
    an empty cache, resulting in a fresh GBFS fetch on every request — poor
    performance and potential rate-limit violations from the Bixi GBFS endpoint.

GBFS endpoints (Bixi Montréal, v2.3):
    - station_information: names, positions, capacity
    - station_status:      real-time bikes/docks available
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# ── Bixi GBFS v2.3 (public, no API key required) ─────────────────────────────
_GBFS_INFO_URL   = "https://gbfs.velobixi.com/gbfs/2-2/en/station_information.json"
_GBFS_STATUS_URL = "https://gbfs.velobixi.com/gbfs/2-2/en/station_status.json"
_CACHE_TTL_SEC   = 300  # 5 minutes

# Fallback static data used when the GBFS API is unreachable
_FALLBACK_STATIONS: list[dict] = [
    {
        "station_id": "1",
        "name": "Métro Mont-Royal / Clark",
        "lat": 45.5235,
        "lon": -73.5857,
        "capacity": 27,
        "num_bikes_available": 12,
        "num_docks_available": 15,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "2",
        "name": "de Maisonneuve / Mackay",
        "lat": 45.4968,
        "lon": -73.5780,
        "capacity": 23,
        "num_bikes_available": 8,
        "num_docks_available": 15,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "3",
        "name": "Vieux-Port / Place Jacques-Cartier",
        "lat": 45.5088,
        "lon": -73.5540,
        "capacity": 31,
        "num_bikes_available": 18,
        "num_docks_available": 13,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "4",
        "name": "McGill / Sherbrooke",
        "lat": 45.5048,
        "lon": -73.5732,
        "capacity": 19,
        "num_bikes_available": 5,
        "num_docks_available": 14,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "5",
        "name": "Plateau / Papineau",
        "lat": 45.5260,
        "lon": -73.5732,
        "capacity": 23,
        "num_bikes_available": 9,
        "num_docks_available": 14,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "6",
        "name": "Quartier Latin / Saint-Denis",
        "lat": 45.5140,
        "lon": -73.5820,
        "capacity": 27,
        "num_bikes_available": 22,
        "num_docks_available": 5,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "7",
        "name": "Mile End / Parc",
        "lat": 45.5225,
        "lon": -73.5985,
        "capacity": 15,
        "num_bikes_available": 7,
        "num_docks_available": 8,
        "last_updated": None,
        "is_fallback": True,
    },
    {
        "station_id": "8",
        "name": "Concordia / Guy",
        "lat": 45.4944,
        "lon": -73.5786,
        "capacity": 21,
        "num_bikes_available": 4,
        "num_docks_available": 17,
        "last_updated": None,
        "is_fallback": True,
    },
]


class BixiService:
    """
    Singleton service that fetches and caches Bixi GBFS station data.

    Usage::

        service = BixiService()
        stations = service.get_stations()
    """

    _instance: "BixiService | None" = None
    _cache: list[dict] = []
    _last_fetch: datetime | None = None
    _using_fallback: bool = False

    # ── Singleton guard ───────────────────────────────────────────────────────

    def __new__(cls) -> "BixiService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            logger.info("BixiService singleton created")
        return cls._instance

    # ── Public API ────────────────────────────────────────────────────────────

    def get_stations(self) -> list[dict]:
        """
        Return a merged list of station info + real-time status.
        Uses the cache if it was populated within the last TTL seconds;
        otherwise fetches fresh data from the Bixi GBFS endpoint.
        Falls back to static data if the network call fails.
        """
        if self._is_cache_valid():
            return self._cache

        try:
            stations = self._fetch_live()
            self._cache = stations
            self._last_fetch = datetime.utcnow()
            self._using_fallback = False
            logger.info("BixiService: fetched %d stations from GBFS", len(stations))
            return self._cache
        except Exception as exc:
            logger.warning("BixiService: GBFS fetch failed (%s); using fallback data", exc)
            self._using_fallback = True
            return _FALLBACK_STATIONS

    @property
    def is_using_fallback(self) -> bool:
        return self._using_fallback

    @property
    def last_updated(self) -> str | None:
        if self._last_fetch is None:
            return None
        return self._last_fetch.isoformat()

    def invalidate_cache(self) -> None:
        """Force a fresh fetch on the next call."""
        self._last_fetch = None
        self._cache = []

    # ── Private helpers ───────────────────────────────────────────────────────

    def _is_cache_valid(self) -> bool:
        if not self._last_fetch or not self._cache:
            return False
        age = (datetime.utcnow() - self._last_fetch).total_seconds()
        return age < _CACHE_TTL_SEC

    def _fetch_live(self) -> list[dict]:
        """Fetch station_information + station_status from Bixi GBFS and merge."""
        import requests  # lazy import so tests can mock without the package

        info_resp = requests.get(_GBFS_INFO_URL, timeout=8)
        info_resp.raise_for_status()
        status_resp = requests.get(_GBFS_STATUS_URL, timeout=8)
        status_resp.raise_for_status()

        info_data   = info_resp.json()
        status_data = status_resp.json()

        # Build a lookup: station_id → status
        status_map: dict[str, dict] = {
            s["station_id"]: s
            for s in status_data.get("data", {}).get("stations", [])
        }

        last_updated_ts: int | None = status_data.get("last_updated")
        last_updated_iso: str | None = (
            datetime.utcfromtimestamp(last_updated_ts).isoformat()
            if last_updated_ts
            else None
        )

        merged: list[dict] = []
        for station in info_data.get("data", {}).get("stations", []):
            sid = station.get("station_id")
            st  = status_map.get(sid, {})
            merged.append({
                "station_id":          sid,
                "name":                station.get("name", "Unknown"),
                "lat":                 station.get("lat"),
                "lon":                 station.get("lon"),
                "capacity":            station.get("capacity", 0),
                "num_bikes_available": st.get("num_bikes_available", 0),
                "num_docks_available": st.get("num_docks_available", 0),
                "last_updated":        last_updated_iso,
                "is_fallback":         False,
            })

        return merged