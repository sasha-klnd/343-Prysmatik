from flask import Flask
from .config import get_config
from .extensions import db, migrate, jwt, bcrypt, cors
from .controllers.auth_controller import auth_bp
from .controllers.user_controller import users_bp
from .controllers.ride_controller import ride_bp
from .controllers.bixi_controller import bixi_bp
from .controllers.analytics_controller import analytics_bp
from .controllers.calculator_controller import calculator_bp
from .controllers.trip_controller import trip_bp
from .utils.errors import register_error_handlers


def create_app() -> Flask:
    app = Flask(__name__)

    # Load config
    app.config.from_object(get_config())

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)

    # Allow all origins in development
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    app.register_blueprint(auth_bp,       url_prefix="/api/auth")
    app.register_blueprint(users_bp,      url_prefix="/api/users")
    app.register_blueprint(ride_bp,       url_prefix="/api/rides")
    app.register_blueprint(bixi_bp,       url_prefix="/api/bixi")
    app.register_blueprint(analytics_bp,  url_prefix="/api/analytics")
    app.register_blueprint(calculator_bp, url_prefix="/api/calculate")
    app.register_blueprint(trip_bp,       url_prefix="/api/trips")

    register_error_handlers(app)

    # Observer pattern — analytics listeners
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
