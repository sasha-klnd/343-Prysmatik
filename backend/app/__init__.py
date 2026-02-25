from flask import Flask
from .config import get_config
from .extensions import db, migrate, jwt, bcrypt, cors
from .controllers.auth_controller import auth_bp
from .controllers.user_controller import users_bp
from .controllers.ride_controller import ride_bp
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
    cors.init_app(
        app,
        resources={
            r"/api/*": {"origins": app.config.get("FRONTEND_ORIGIN", "*")}},
        supports_credentials=False,
    )

    # Register blueprints (Controllers)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(ride_bp, url_prefix="/api/rides")

    register_error_handlers(app)

    @app.get("/api/health")
    def health():
        return {"ok": True, "service": "urbix-backend"}

    return app
