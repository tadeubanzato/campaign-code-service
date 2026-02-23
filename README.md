# campaign-code-service

Professional-grade lightweight API to generate human-readable 6–12 character campaign codes.

## Features

- Deterministic + fast generation (no heavy model required)
- Human-readable alphanumeric code candidates
- Strong API contract with:
  - structured success response
  - structured error response
  - UTC timestamp
  - request id
  - processing time (ms)

## API Contract

### `GET /health`

Response:

```json
{
  "ok": true,
  "data": {
    "service": "campaign-code-service",
    "status": "healthy"
  },
  "meta": {
    "timestamp": "2026-02-23T03:00:00+00:00",
    "request_id": "uuid"
  }
}
```

### `POST /generate`

Request body:

```json
{
  "campaign_name": "Spring Aurora Lights 2026",
  "min_len": 6,
  "max_len": 10,
  "include_year": true,
  "count": 8,
  "seed": 123
}
```

Success (`200`):

```json
{
  "ok": true,
  "data": {
    "campaign_name": "Spring Aurora Lights 2026",
    "generated_code": "AULI2026",
    "candidates": ["AULI2026", "SPAU26", "AURS26"]
  },
  "meta": {
    "timestamp": "2026-02-23T03:00:00+00:00",
    "request_id": "uuid",
    "processing_ms": 7
  }
}
```

Error format (`4xx/5xx`):

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "campaign_name is required",
    "details": null
  },
  "meta": {
    "timestamp": "2026-02-23T03:00:00+00:00",
    "request_id": "uuid"
  }
}
```

### Common errors

- `400 INVALID_JSON`
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `405 METHOD_NOT_ALLOWED`
- `500 INTERNAL_ERROR`

## Run locally

```bash
cd campaign-code-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

Test:

```bash
curl http://127.0.0.1:8080/health

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

Production container command uses Gunicorn:

```bash
gunicorn -w 2 -b 0.0.0.0:8080 app.main:app
```

## Node.js version (kept alongside Python)

A full Node.js implementation with the same API contract is included under `node/`.

### Run Node locally

```bash
cd campaign-code-service/node
npm install
npm run start
```

Node service defaults to port `8081`.

Test:

```bash
curl http://127.0.0.1:8081/health

curl -X POST http://127.0.0.1:8081/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "campaign_name":"Spring Aurora Lights 2026",
    "min_len":6,
    "max_len":10,
    "include_year":true,
    "count":8
  }'
```

Response contract is intentionally aligned with the Python service:
- `ok`
- `data.campaign_name`
- `data.generated_code`
- `data.candidates`
- `meta.timestamp`
- `meta.request_id`
- `meta.processing_ms`

## Azure-ready

Both versions are deployable to:
- Azure Container Apps
- Azure App Service (container)
- Azure Container Instances
