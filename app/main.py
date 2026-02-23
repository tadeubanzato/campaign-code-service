from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4

from flask import Flask, jsonify, request

from .generator import generate_codes

app = Flask(__name__)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def error_response(status: int, code: str, message: str, details=None):
    return (
        jsonify(
            {
                "ok": False,
                "error": {
                    "code": code,
                    "message": message,
                    "details": details,
                },
                "meta": {
                    "timestamp": utc_now_iso(),
                    "request_id": str(uuid4()),
                },
            }
        ),
        status,
    )


@app.get('/health')
def health():
    return jsonify(
        {
            "ok": True,
            "data": {"service": "campaign-code-service", "status": "healthy"},
            "meta": {"timestamp": utc_now_iso(), "request_id": str(uuid4())},
        }
    )


@app.post('/generate')
def generate():
    started = perf_counter()
    req_id = str(uuid4())

    data = request.get_json(silent=True)
    if data is None:
        return error_response(400, "INVALID_JSON", "Request body must be valid JSON")

    campaign_name = str(data.get('campaign_name', '')).strip()
    campaign_description = str(data.get('campaign_description', '')).strip()
    if not campaign_name:
        return error_response(400, "VALIDATION_ERROR", "campaign_name is required")

    try:
        min_len = int(data.get('min_len', 6))
        max_len = int(data.get('max_len', 10))
        include_year = bool(data.get('include_year', True))
        count = int(data.get('count', 8))
        seed = data.get('seed', None)
    except Exception as e:
        return error_response(400, "VALIDATION_ERROR", "Invalid request fields", str(e))

    try:
        combined_context = campaign_name if not campaign_description else f"{campaign_name} {campaign_description}"
        codes = generate_codes(
            combined_context,
            min_len=min_len,
            max_len=max_len,
            include_year=include_year,
            count=count,
            seed=seed,
        )
    except ValueError as e:
        return error_response(400, "VALIDATION_ERROR", str(e))
    except Exception as e:
        return error_response(500, "INTERNAL_ERROR", "Unexpected generator failure", str(e))

    elapsed_ms = int((perf_counter() - started) * 1000)

    return jsonify(
        {
            "ok": True,
            "data": {
                "campaign_name": campaign_name,
                "campaign_description": campaign_description,
                "generated_code": codes[0],
                "candidates": codes,
                "generation_mode": "rules_only",
            },
            "meta": {
                "timestamp": utc_now_iso(),
                "request_id": req_id,
                "processing_ms": elapsed_ms,
            },
        }
    )


@app.errorhandler(404)
def not_found(_):
    return error_response(404, "NOT_FOUND", "Route not found")


@app.errorhandler(405)
def method_not_allowed(_):
    return error_response(405, "METHOD_NOT_ALLOWED", "HTTP method not allowed for this route")


@app.errorhandler(500)
def unhandled(_):
    return error_response(500, "INTERNAL_ERROR", "Unhandled server error")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
