from flask import Flask, request, jsonify
from .generator import generate_codes

app = Flask(__name__)


@app.get('/health')
def health():
    return jsonify({"ok": True})


@app.post('/generate')
def generate():
    data = request.get_json(silent=True) or {}
    campaign_name = str(data.get('campaign_name', '')).strip()
    min_len = int(data.get('min_len', 6))
    max_len = int(data.get('max_len', 10))
    include_year = bool(data.get('include_year', True))
    count = int(data.get('count', 8))
    seed = data.get('seed', None)

    if not campaign_name:
        return jsonify({"error": "campaign_name is required"}), 400

    try:
        codes = generate_codes(
            campaign_name,
            min_len=min_len,
            max_len=max_len,
            include_year=include_year,
            count=count,
            seed=seed,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"primary": codes[0], "candidates": codes})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
