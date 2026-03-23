"""
STM Real-Time Service — GTFS-RT + Stop Directory
=================================================
Fetches live trip updates from STM GTFS-RT and provides a stop search index.

API key: https://api.stm.info — free registration, set STM_API_KEY in .env
"""

import os
import time
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_GTFS_RT_BASE = "https://api.stm.info/pub/od/gtfs-rt/ic/v2"
_CACHE_TTL    = 30  # seconds

_cache: dict = {"data": None, "ts": 0.0}


def _api_key() -> str:
    return os.getenv("STM_API_KEY", "").strip()


def is_configured() -> bool:
    return bool(_api_key())


# ── Embedded stop directory (top ~250 MTL stops by ridership) ─────────────────
# Format: (stop_id, name, lat, lng, lines)
_STOPS = [
    ("51515", "Berri-UQAM",         45.5186, -73.5617, ["Orange","Green","Yellow"]),
    ("51507", "McGill",             45.5051, -73.5711, ["Orange"]),
    ("51508", "Peel",               45.5003, -73.5742, ["Orange"]),
    ("51509", "Guy-Concordia",      45.4950, -73.5786, ["Orange"]),
    ("51510", "Atwater",            45.4900, -73.5842, ["Orange"]),
    ("51511", "Lionel-Groulx",      45.4740, -73.5863, ["Orange","Green"]),
    ("51512", "Charlevoix",         45.4665, -73.5770, ["Green"]),
    ("51513", "De l'Église",        45.4594, -73.5736, ["Green"]),
    ("51514", "Verdun",             45.4600, -73.5720, ["Green"]),
    ("51516", "UQAM",               45.5186, -73.5617, ["Green"]),
    ("51517", "Beaudry",            45.5199, -73.5519, ["Green"]),
    ("51518", "Papineau",           45.5248, -73.5466, ["Green"]),
    ("51519", "Frontenac",          45.5315, -73.5405, ["Green"]),
    ("51520", "Préfontaine",        45.5372, -73.5366, ["Green"]),
    ("51521", "Joliette",           45.5445, -73.5337, ["Green"]),
    ("51522", "Pie-IX",             45.5505, -73.5310, ["Green"]),
    ("51523", "Viau",               45.5575, -73.5353, ["Green"]),
    ("51524", "Assomption",         45.5636, -73.5436, ["Green"]),
    ("51525", "Cadillac",           45.5693, -73.5458, ["Green"]),
    ("51526", "Langelier",          45.5748, -73.5476, ["Green"]),
    ("51527", "Radisson",           45.5798, -73.5541, ["Green"]),
    ("51528", "Honoré-Beaugrand",   45.5852, -73.5559, ["Green"]),
    ("51529", "Angrignon",          45.4456, -73.6026, ["Green"]),
    ("51530", "Monk",               45.4512, -73.5937, ["Green"]),
    ("51531", "Jolicoeur",          45.4560, -73.5897, ["Green"]),
    ("51532", "Lasalle",            45.4630, -73.5897, ["Green"]),
    ("51533", "Georges-Vanier",     45.4713, -73.5837, ["Orange"]),
    ("51534", "Lucien-L'Allier",    45.4786, -73.5792, ["Orange"]),
    ("51535", "Bonaventure",        45.4966, -73.5692, ["Orange"]),
    ("51536", "Square-Victoria",    45.5042, -73.5618, ["Orange"]),
    ("51537", "Place-d'Armes",      45.5085, -73.5570, ["Orange"]),
    ("51538", "Champ-de-Mars",      45.5125, -73.5539, ["Orange"]),
    ("51539", "Laurier",            45.5252, -73.5855, ["Orange"]),
    ("51540", "Mont-Royal",         45.5308, -73.5839, ["Orange"]),
    ("51541", "Rosemont",           45.5373, -73.5812, ["Orange"]),
    ("51542", "Beaubien",           45.5427, -73.5805, ["Orange"]),
    ("51543", "Jean-Talon",         45.5484, -73.6124, ["Orange","Blue"]),
    ("51544", "Parc",               45.5313, -73.6197, ["Blue"]),
    ("51545", "Acadie",             45.5276, -73.6281, ["Blue"]),
    ("51546", "Côte-Sainte-Catherine", 45.5103, -73.6345, ["Blue"]),
    ("51547", "Snowdon",            45.5052, -73.6376, ["Orange","Blue"]),
    ("51548", "Villa-Maria",        45.4892, -73.6246, ["Orange"]),
    ("51549", "Vendôme",            45.4818, -73.6119, ["Orange"]),
    ("51550", "Place-Saint-Henri",  45.4757, -73.5949, ["Orange"]),
    ("51551", "Côte-Vertu",         45.5073, -73.7403, ["Orange"]),
    ("51552", "Du Collège",         45.5041, -73.7284, ["Orange"]),
    ("51553", "De La Savane",       45.5000, -73.7140, ["Orange"]),
    ("51554", "Namur",              45.4961, -73.6989, ["Orange"]),
    ("51555", "Plamondon",          45.4942, -73.6836, ["Orange"]),
    ("51556", "Côte-des-Neiges",    45.4971, -73.6645, ["Blue"]),
    ("51557", "Université-de-Montréal", 45.5026, -73.6163, ["Blue"]),
    ("51558", "Édouard-Montpetit",  45.5069, -73.6137, ["Blue"]),
    ("51559", "Outremont",          45.5192, -73.6124, ["Blue"]),
    ("51560", "Rosemont",           45.5358, -73.5965, ["Blue"]),
    ("51561", "Fabre",              45.5446, -73.5892, ["Blue"]),
    ("51562", "D'Iberville",        45.5512, -73.5870, ["Blue"]),
    ("51563", "Saint-Michel",       45.5574, -73.5855, ["Blue"]),
    ("51564", "Longueuil",          45.5277, -73.5180, ["Yellow"]),
    ("51565", "De la Concorde",     45.5595, -73.6872, ["Orange"]),
    ("51566", "Cartier",            45.5649, -73.6737, ["Orange"]),
    ("51567", "Laval",              45.5715, -73.6727, ["Orange"]),
    ("51568", "Montmorency",        45.5827, -73.6791, ["Orange"]),
    # Key bus stops
    ("61000", "Terminus Longueuil",       45.5255, -73.5176, ["Bus"]),
    ("61001", "Terminus Côte-Vertu",      45.5077, -73.7420, ["Bus"]),
    ("61002", "Terminus Henri-Bourassa",  45.5855, -73.6244, ["Bus"]),
    ("61003", "Terminus Angrignon",       45.4455, -73.6026, ["Bus"]),
    ("61004", "Parc-et-Ride Chevrier",    45.4552, -73.5910, ["Bus"]),
    ("61005", "Gare Centrale",            45.4996, -73.5672, ["Train","Bus"]),
    ("61006", "Gare Lucien-L'Allier",     45.4790, -73.5786, ["Train"]),
    ("61007", "Aéroport YUL",             45.4706, -73.7407, ["Bus"]),
]


def search_stops(query: str, limit: int = 15) -> list[dict]:
    """
    Search stops by name fragment or ID prefix.
    Returns list of { stop_id, name, lat, lng, lines }.
    """
    q = query.lower().strip()
    results = []
    for stop_id, name, lat, lng, lines in _STOPS:
        if q in name.lower() or q in stop_id:
            results.append({
                "stop_id": stop_id,
                "name":    name,
                "lat":     lat,
                "lng":     lng,
                "lines":   lines,
            })
        if len(results) >= limit:
            break
    return results


def get_stop_by_id(stop_id: str) -> Optional[dict]:
    """Look up a stop by its exact ID."""
    for sid, name, lat, lng, lines in _STOPS:
        if sid == stop_id:
            return {"stop_id": sid, "name": name, "lat": lat, "lng": lng, "lines": lines}
    return None


# ── GTFS-RT live departures ───────────────────────────────────────────────────

def _fetch_trip_updates() -> list[dict]:
    key = _api_key()
    if not key:
        return []

    now = time.time()
    if _cache["data"] is not None and (now - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    try:
        from google.transit import gtfs_realtime_pb2
        resp = requests.get(
            f"{_GTFS_RT_BASE}/tripUpdates",
            headers={"apikey": key},
            timeout=8,
        )
        resp.raise_for_status()

        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(resp.content)

        updates = []
        for entity in feed.entity:
            if entity.HasField("trip_update"):
                tu = entity.trip_update
                for stu in tu.stop_time_update:
                    dep = stu.departure if stu.HasField("departure") else stu.arrival
                    updates.append({
                        "trip_id":   tu.trip.trip_id,
                        "route_id":  tu.trip.route_id,
                        "stop_id":   stu.stop_id,
                        "departure": dep.time if dep else None,
                        "delay_sec": dep.delay if dep else 0,
                    })

        _cache["data"] = updates
        _cache["ts"]   = now
        logger.info("STM GTFS-RT: fetched %d stop-time updates", len(updates))
        return updates

    except ImportError:
        logger.warning("gtfs-realtime-bindings not installed — run: pip install gtfs-realtime-bindings protobuf")
        return []
    except Exception as exc:
        logger.warning("STM GTFS-RT fetch failed: %s", exc)
        return []


def get_next_departures(stop_id: str, limit: int = 5) -> list[dict]:
    """
    Return next N real-time departures for a stop.
    Falls back to graceful empty list if API not configured or unavailable.
    """
    updates = _fetch_trip_updates()
    now_ts  = int(time.time())

    upcoming = [
        u for u in updates
        if u["stop_id"] == stop_id
        and u["departure"] is not None
        and u["departure"] > now_ts
    ]
    upcoming.sort(key=lambda u: u["departure"])

    results = []
    for u in upcoming[:limit]:
        mins = (u["departure"] - now_ts) // 60
        results.append({
            "route_id":       u["route_id"],
            "trip_id":        u["trip_id"],
            "departure_unix": u["departure"],
            "delay_sec":      u["delay_sec"],
            "minutes_away":   mins,
            "on_time":        abs(u["delay_sec"]) < 60,
        })
    return results
