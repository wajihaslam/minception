"""
main.py — Minception Mock Service

Responsibilities:
  - Catch all incoming HTTP requests to /mock/*
  - Match against configured gateways/endpoints/flavors
  - Return mock response
  - Expose /health and /reload endpoints
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app import engine
from app.config import settings
from app.logging_handler import DBLogHandler, RequestContextFilter, RequestContextMiddleware
from app.mongo import get_db, close_client
from app.routes.health import router as health_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_min_level = getattr(logging, settings.ERROR_LOG_MIN_LEVEL.upper(), logging.WARNING)
_db_handler = DBLogHandler(
    mongo_url=settings.ADMIN_DB_URL,
    service_name="mock-service",
    min_level=_min_level,
)
_ctx_filter = RequestContextFilter()
logging.getLogger().addHandler(_db_handler)
logging.getLogger().addFilter(_ctx_filter)


async def load_gateway_configs():
    """Load all active gateways from MongoDB into memory."""
    db = get_db()
    gateways = await db.gateways.find({"is_active": True}).to_list(None)
    engine.load_configs(gateways)
    logger.info(f"Loaded {len(gateways)} gateway configs from MongoDB")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Minception Mock Service...")
    await load_gateway_configs()
    yield
    # Shutdown
    logger.info("Shutting down Minception Mock Service...")
    await close_client()


app = FastAPI(
    title="Minception — Mock Service",
    description="Intercepts HTTP requests and returns configured mock responses",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)


@app.post("/reload")
async def reload_configs():
    """
    Reload all gateway configs from MongoDB.
    Called by Admin Service after any create/update/delete.
    """
    await load_gateway_configs()
    return {"success": True, "data": {"configs_loaded": len(engine.get_configs())}, "error": None}


@app.api_route("/mock/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def catch_all(full_path: str, request: Request):
    """
    Catch-all mock handler. Matches incoming request against gateway configs.
    """
    # Reconstruct path with leading slash
    path = f"/{full_path}"

    # Parse body
    body = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = None
    elif content_type:
        try:
            body = (await request.body()).decode("utf-8")
        except Exception:
            body = None

    result = engine.match_request(
        method=request.method,
        path=path,
        headers=dict(request.headers),
        body=body,
        query_params=dict(request.query_params),
    )

    # Log to MongoDB (fire-and-forget)
    asyncio.create_task(_log_request(request, path, result))

    # Apply delay if configured
    if result.response.delay_ms > 0:
        await asyncio.sleep(result.response.delay_ms / 1000)

    # Build response
    response_body = result.response.body
    response_headers = result.response.headers

    # Default content-type if body is a dict/list
    if isinstance(response_body, (dict, list)):
        import json
        response_headers.setdefault("Content-Type", "application/json")
        return Response(
            content=json.dumps(response_body),
            status_code=result.response.status,
            headers=response_headers,
            media_type="application/json",
        )

    return Response(
        content=str(response_body) if response_body is not None else "",
        status_code=result.response.status,
        headers=response_headers,
    )


async def _log_request(request: Request, path: str, result):
    """Write request log to MongoDB asynchronously — does not block the response."""
    try:
        db = get_db()
        await db.request_logs.insert_one({
            "endpoint_path": path,
            "method": request.method,
            "matched_flavor": result.flavor_name,
            "matched": result.matched,
            "request": {
                "headers": dict(request.headers),
                "query": dict(request.query_params),
            },
            "response": {
                "status": result.response.status,
            },
            "client_ip": request.client.host if request.client else None,
            "timestamp": __import__("datetime").datetime.utcnow(),
        })
    except Exception as e:
        logger.warning(f"Failed to log request: {e}")
