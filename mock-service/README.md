# Mock Service

Stateless HTTP intercept service. Matches incoming requests against MongoDB-configured gateway/endpoint/flavor rules and returns mock responses.

## Port: 8001

## Key Files
- `app/engine.py` — Core matching logic (start here)
- `app/main.py` — FastAPI app, catch-all route, /reload endpoint
- `app/mongo.py` — Async MongoDB connection
- `app/models.py` — Pydantic data models

## Run Locally (without Docker)
```bash
cd mock-service
pip install -r requirements.txt
MONGO_URL=mongodb://localhost:27017/api_gateway_dev uvicorn app.main:app --reload --port 8001
```

## Run Tests
```bash
cd mock-service
pytest app/tests/ -v
pytest app/tests/ -v --cov=app --cov-report=term-missing
```

## API Endpoints
- `ANY /mock/{path}` — Mock request handler
- `GET /health` — Health + config count
- `POST /reload` — Reload configs from MongoDB (called by Admin Service)
- `GET /docs` — Auto-generated Swagger UI

## How It Works
1. On startup: loads all active gateways from MongoDB into memory
2. Each request: `path` is matched against gateway `base_path`
3. Remaining path + method matched against endpoint
4. Flavors evaluated by `priority` (desc) — first match wins
5. Default flavor used as fallback
6. Response returned with configured status/headers/body/delay
