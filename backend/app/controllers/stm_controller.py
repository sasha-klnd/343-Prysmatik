"""
STM Controller
==============
Real-time STM departure data + stop search.

GET /api/stm/next-departures?stop_id=<id>&limit=3
GET /api/stm/stops?q=<name>           — search stops by name
GET /api/stm/status
"""

from flask import Blueprint, request
from ..services.stm_service import get_next_departures, is_configured, search_stops
from ..utils.responses import ok, fail

stm_bp = Blueprint("stm", __name__)


@stm_bp.get("/next-departures")
def next_departures():
    stop_id = (request.args.get("stop_id") or "").strip()
    if not stop_id:
        return fail("stop_id query parameter is required", 400)
    try:
        limit = max(1, min(int(request.args.get("limit", 5)), 10))
    except ValueError:
        return fail("limit must be an integer", 400)

    departures = get_next_departures(stop_id, limit=limit)
    return ok({
        "stop_id":    stop_id,
        "departures": departures,
        "configured": is_configured(),
    })


@stm_bp.get("/stops")
def stops_search():
    """Search stops by name or ID fragment — returns top 15 matches."""
    q = (request.args.get("q") or "").strip().lower()
    if not q or len(q) < 2:
        return fail("q must be at least 2 characters", 400)
    results = search_stops(q)
    return ok({"stops": results, "query": q})


@stm_bp.get("/status")
def stm_status():
    return ok({"configured": is_configured()})
