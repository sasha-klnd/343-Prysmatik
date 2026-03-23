"""
Config Controller
=================
Exposes public configuration values to the frontend.
Only non-secret keys that are safe to expose to the browser are returned.
The Google Maps API key is browser-safe (restricted by domain in production).
"""

import os
from flask import Blueprint
from ..utils.responses import ok

config_bp = Blueprint("config", __name__)


@config_bp.get("/maps-key")
def get_maps_key():
    key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    return ok({"key": key if key else None})
