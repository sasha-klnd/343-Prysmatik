"""
Geocoding and routing utilities.
Priority order:
  1. Local Montréal landmarks dict (instant, no network)
  2. Google Maps Geocoding API (reliable, handles any address)
  3. Nominatim fallback (if Google key not configured)
"""

import os
import math
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_HEADERS = {"User-Agent": "UrbiX-SUMMS/1.0 (soen343@concordia.ca)"}


def _google_key() -> str:
    return os.getenv("GOOGLE_MAPS_API_KEY", "").strip()


def geocode(address: str, city_hint: str = "Montréal") -> Optional[tuple[float, float]]:
    """
    Returns (lat, lon) for a given address string, or None if not found.
    Tries landmarks dict → Google Maps → Nominatim.
    """
    import requests
    from .montreal_landmarks import lookup_landmark

    # 1. Instant local lookup
    coords = lookup_landmark(address)
    if coords:
        return coords
    coords = lookup_landmark(address.split(",")[0].strip())
    if coords:
        return coords

    # 2. Google Maps Geocoding API
    api_key = _google_key()
    if api_key:
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": f"{address}, {city_hint}, QC, Canada", "key": api_key},
                timeout=8,
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
        except Exception as exc:
            logger.warning("Google Geocoding failed for '%s': %s", address, exc)

    # 3. Nominatim fallback
    for query in [f"{address}, {city_hint}, QC, Canada", f"{address}, QC, Canada", f"{address}, Canada"]:
        try:
            resp = requests.get(
                _NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": 1},
                headers=_HEADERS,
                timeout=6,
            )
            results = resp.json()
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
        except Exception as exc:
            logger.warning("Nominatim failed for '%s': %s", address, exc)
        time.sleep(0.3)

    return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_between(origin: str, destination: str) -> Optional[float]:
    coords_a = geocode(origin)
    time.sleep(0.2)
    coords_b = geocode(destination)
    if coords_a is None or coords_b is None:
        return None
    straight = haversine_km(coords_a[0], coords_a[1], coords_b[0], coords_b[1])
    return round(straight * 1.3, 2)
