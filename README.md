# campaign-code-service

Lightweight standalone API to generate human-readable 6-12 character campaign codes.

## Run locally

```bash
cd campaign-code-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

Health check:

```bash
curl http://127.0.0.1:8080/health
```

Generate:

```bash
curl -X POST http://127.0.0.1:8080/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "campaign_name":"Spring Aurora Lights 2026",
    "min_len":6,
    "max_len":10,
    "include_year":true,
    "count":8
  }'
```

## Docker

```bash
docker build -t campaign-code-service .
docker run --rm -p 8080:8080 campaign-code-service
```

## Example output

```json
{
  "primary": "AULI2026",
  "candidates": ["AULI2026", "SPAU26", "SAUL26", "AURS26"]
}
```
