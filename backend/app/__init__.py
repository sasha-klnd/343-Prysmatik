from flask import Flask
from .config import get_config
from .extensions import db, migrate, jwt, bcrypt, cors, limiter
from .controllers.auth_controller import auth_bp, login, register
from .controllers.user_controller import users_bp
from .controllers.ride_controller import ride_bp
from .controllers.bixi_controller import bixi_bp
from .controllers.analytics_controller import analytics_bp
from .controllers.calculator_controller import calculator_bp
from .controllers.trip_controller import trip_bp
from .controllers.ai_controller import ai_bp
from .controllers.config_controller import config_bp
from .controllers.parking_controller import parking_bp
from .controllers.stm_controller import stm_bp
from .controllers.rating_controller import rating_bp
from .utils.errors import register_error_handlers


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config())

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    limiter.init_app(app)

    allowed_origin = app.config.get("FRONTEND_ORIGIN", "http://localhost:5173")
    cors.init_app(app, resources={r"/api/*": {"origins": allowed_origin}})

    # ── Rate limits ────────────────────────────────────────────────────────────
    ai_limit      = app.config.get("RATELIMIT_AI_CHAT",    "30 per minute")
    geo_limit     = app.config.get("RATELIMIT_GEOCODING",  "60 per minute")
    auth_limit    = app.config.get("RATELIMIT_AUTH",       "10 per minute")

    # Apply limits to the expensive/sensitive endpoints
    from .controllers.ai_controller import chat
    from .controllers.calculator_controller import calculate_route, route_geometry
    from .controllers.parking_controller import near_address
    limiter.limit(ai_limit)(chat)
    limiter.limit(geo_limit)(calculate_route)
    limiter.limit(geo_limit)(route_geometry)
    limiter.limit(geo_limit)(near_address)

    app.register_blueprint(auth_bp,       url_prefix="/api/auth")
    app.register_blueprint(users_bp,      url_prefix="/api/users")
    app.register_blueprint(ride_bp,       url_prefix="/api/rides")
    app.register_blueprint(bixi_bp,       url_prefix="/api/bixi")
    app.register_blueprint(analytics_bp,  url_prefix="/api/analytics")
    app.register_blueprint(calculator_bp, url_prefix="/api/calculate")
    app.register_blueprint(trip_bp,       url_prefix="/api/trips")
    app.register_blueprint(ai_bp,         url_prefix="/api/ai")
    app.register_blueprint(config_bp,     url_prefix="/api/config")
    app.register_blueprint(parking_bp,    url_prefix="/api/parking")
    app.register_blueprint(stm_bp,        url_prefix="/api/stm")
    app.register_blueprint(rating_bp,     url_prefix="/api/ratings")

    # Apply auth rate limit to login/register
    limiter.limit(auth_limit)(login)
    limiter.limit(auth_limit)(register)

    register_error_handlers(app)
    _setup_event_bus()

    @app.get("/api/health")
    def health():
        return {"ok": True, "service": "urbix-backend"}

    return app


def _setup_event_bus():
    from .services.event_bus import EventBus, DBAnalyticsObserver, LoggingAnalyticsObserver
    EventBus.clear()
    EventBus.subscribe(DBAnalyticsObserver())
    EventBus.subscribe(LoggingAnalyticsObserver())
