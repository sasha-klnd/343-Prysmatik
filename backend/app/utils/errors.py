from flask import Flask
from werkzeug.exceptions import HTTPException
from .responses import fail


def register_error_handlers(app: Flask):
    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        return fail(e.description, status=e.code or 400)

    @app.errorhandler(Exception)
    def handle_unexpected(e: Exception):
        # In production you’d log this
        return fail("Unexpected server error", status=500)
