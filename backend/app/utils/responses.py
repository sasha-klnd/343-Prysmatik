from flask import jsonify


def ok(data=None, status=200):
    return jsonify({"success": True, "data": data}), status


def fail(message, status=400, code=None):
    payload = {"success": False, "error": {"message": message}}
    if code:
        payload["error"]["code"] = code
    return jsonify(payload), status
