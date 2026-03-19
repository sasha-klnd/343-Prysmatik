"""
Bixi Controller (Issue 5 + 6)
==============================
Exposes Bixi station data via REST endpoints.
Uses the BixiService Singleton to read from cache or the GBFS API.
"""

from flask import Blueprint, request
from ..services.bixi_service import BixiService
from ..utils.responses import ok, fail

bixi_bp = Blueprint("bixi", __name__)


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/bixi/stations
#   Returns all stations (merged info + real-time status).
#   Query params:
#     lat, lon, radius_km  → filter by proximity (optional)
#     min_bikes            → only stations with ≥ N bikes (optional)
#     min_docks            → only stations with ≥ N free docks (optional)
# ──────────────────────────────────────────────────────────────────────────────
@bixi_bp.get("/stations")
def get_stations():
    bixi = BixiService()

    try:
        stations = bixi.get_stations()
    except Exception as exc:
        return fail(f"Unable to retrieve BIXI data: {str(exc)}", 503)

    # Optional proximity filter
    lat_str = request.args.get("lat")
    lon_str = request.args.get("lon")
    radius_km_str = request.args.get("radius_km", "2.0")

    if lat_str and lon_str:
        try:
            lat = float(lat_str)
            lon = float(lon_str)
            radius_km = float(radius_km_str)
            stations = _filter_by_proximity(stations, lat, lon, radius_km)
        except ValueError:
            return fail("lat, lon, and radius_km must be numbers", 400)

    # Optional availability filters
    min_bikes_str = request.args.get("min_bikes")
    min_docks_str = request.args.get("min_docks")

    if min_bikes_str:
        try:
            min_bikes = int(min_bikes_str)
            stations = [s for s in stations if s.get("num_bikes_available", 0) >= min_bikes]
        except ValueError:
            return fail("min_bikes must be an integer", 400)

    if min_docks_str:
        try:
            min_docks = int(min_docks_str)
            stations = [s for s in stations if s.get("num_docks_available", 0) >= min_docks]
        except ValueError:
            return fail("min_docks must be an integer", 400)

    return ok({
        "stations": stations,
        "total": len(stations),
        "last_updated": bixi.last_updated,
        "is_fallback": bixi.is_using_fallback,
    })


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/bixi/refresh
#   Forces a fresh fetch from the GBFS API (ignores cache).
# ──────────────────────────────────────────────────────────────────────────────
@bixi_bp.post("/refresh")
def refresh_stations():
    bixi = BixiService()
    bixi.invalidate_cache()

    try:
        stations = bixi.get_stations()
    except Exception as exc:
        return fail(f"GBFS refresh failed: {str(exc)}", 503)

    return ok({
        "message": "Cache refreshed",
        "station_count": len(stations),
        "last_updated": bixi.last_updated,
        "is_fallback": bixi.is_using_fallback,
    })


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two lat/lon points."""
    import math
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _filter_by_proximity(
    stations: list[dict],
    lat: float,
    lon: float,
    radius_km: float,
) -> list[dict]:
    result = []
    for s in stations:
        slat = s.get("lat")
        slon = s.get("lon")
        if slat is None or slon is None:
            continue
        dist = _haversine_km(lat, lon, slat, slon)
        if dist <= radius_km:
            s_copy = dict(s)
            s_copy["distance_km"] = round(dist, 3)
            result.append(s_copy)

    result.sort(key=lambda s: s.get("distance_km", 9999))
    return result
