import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    SECRET_KEY     = os.getenv("SECRET_KEY",     "dev-secret-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-me")

    # Access token expires in 15 min; refresh token in 30 days
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    SQLALCHEMY_DATABASE_URI      = os.getenv("DATABASE_URL", "sqlite:///app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL",    "admin@urbix.ai")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

    # Firebase Cloud Messaging (optional — push notifications)
    FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "")

    # STM GTFS-RT API key (https://api.stm.info — register for free)
    STM_API_KEY = os.getenv("STM_API_KEY", "")

    # Rate limits
    RATELIMIT_AI_CHAT        = os.getenv("RATELIMIT_AI_CHAT",    "30 per minute")
    RATELIMIT_GEOCODING      = os.getenv("RATELIMIT_GEOCODING",  "60 per minute")
    RATELIMIT_AUTH           = os.getenv("RATELIMIT_AUTH",       "10 per minute")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    # Looser limits in dev so you can iterate freely
    RATELIMIT_AI_CHAT   = "120 per minute"
    RATELIMIT_GEOCODING = "240 per minute"
    RATELIMIT_AUTH      = "60 per minute"


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///test.db"
    # Disable limits in tests
    RATELIMIT_AI_CHAT   = "10000 per minute"
    RATELIMIT_GEOCODING = "10000 per minute"
    RATELIMIT_AUTH      = "10000 per minute"


class ProductionConfig(BaseConfig):
    DEBUG = False


def get_config():
    env = os.getenv("FLASK_ENV", "development").lower()
    if env == "production":
        return ProductionConfig
    if env == "testing":
        return TestingConfig
    return DevelopmentConfig
