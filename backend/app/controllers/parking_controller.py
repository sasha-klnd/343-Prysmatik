"""
Parking Controller
==================
Fetches real parking locations near a given address using the
Google Maps Places Nearby Search API.

GET /api/parking/near-address?address=...&radius=800
  → geocodes the address, then calls Places API for nearby parking.
"""

import os
import logging
import requests as req

from flask import Blueprint, request
from ..utils.responses import ok, fail
from ..utils.geocoding import geocode

parking_bp = Blueprint("parking", __name__)
logger = logging.getLogger(__name__)


@parking_bp.get("/near-address")
def near_address():
    address = (request.args.get("address") or "").strip()
    radius  = request.args.get("radius", "800")

    if not address:
        return fail("'address' query parameter is required", 400)

    try:
        radius = min(int(radius), 5000)
    except ValueError:
        return fail("radius must be an integer (metres, max 5000)", 400)

    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        return fail(
            "Google Maps API key not configured on the server. "
            "Set GOOGLE_MAPS_API_KEY in your .env file.",
            503,
        )

    # Step 1 — geocode the address
    coords = geocode(address)
    if coords is None:
        return fail(
            f"Could not geocode '{address}'. "
            "Try a more specific address (e.g. 'McGill University, Montréal').",
            422,
        )
    lat, lng = coords

    # Step 2 — call Google Places Nearby Search for parking
    try:
        resp = req.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "location": f"{lat},{lng}",
                "radius":   radius,
                "type":     "parking",
                "key":      api_key,
            },
            timeout=10,
        )
        data = resp.json()
    except Exception as exc:
        logger.error("Google Places request failed: %s", exc)
        return fail("Failed to reach Google Maps API", 502)

    status = data.get("status")
    if status == "ZERO_RESULTS":
        return ok({
            "places": [],
            "total":  0,
            "center": {"lat": lat, "lng": lng, "label": address},
        })

    if status != "OK":
        logger.warning("Google Places API returned status=%s for address='%s'", status, address)
        return fail(f"Google Places API error: {status}", 502)

    # Step 3 — normalise results
    PRICE_LABELS = {0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}

    places = []
    for p in data.get("results", [])[:20]:
        loc = p.get("geometry", {}).get("location", {})
        price_level = p.get("price_level")
        places.append({
            "id":          p.get("place_id"),
            "name":        p.get("name"),
            "lat":         loc.get("lat"),
            "lng":         loc.get("lng"),
            "address":     p.get("vicinity", ""),
            "rating":      p.get("rating"),
            "open_now":    p.get("opening_hours", {}).get("open_now"),
            "price_level": price_level,
            "price_label": PRICE_LABELS.get(price_level, "Unknown"),
            "types":       p.get("types", []),
        })

    return ok({
        "places": places,
        "total":  len(places),
        "center": {"lat": lat, "lng": lng, "label": address},
    })
