import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.passwords import hash_password
from app.config import settings
from app.mongo import close_client, get_db
from app.routes.auth import router as auth_router
from app.routes.endpoints import router as endpoints_router
from app.routes.flavors import router as flavors_router
from app.routes.gateways import router as gateways_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _ensure_admin_user() -> None:
    """Create the default admin account on first boot if it doesn't already exist."""
    db = get_db()
    existing = await db.users.find_one({"username": settings.ADMIN_USERNAME})
    if not existing:
        await db.users.insert_one({
            "username": settings.ADMIN_USERNAME,
            "email": settings.ADMIN_EMAIL,
            "password_hash": hash_password(settings.ADMIN_PASSWORD),
            "role": "admin",
            "is_active": True,
        })
        logger.info("Default admin user created")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Minception Admin Service...")
    await _ensure_admin_user()
    yield
    logger.info("Shutting down Minception Admin Service...")
    await close_client()


app = FastAPI(
    title="Minception — Admin Service",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(gateways_router)
app.include_router(endpoints_router)
app.include_router(flavors_router)


@app.get("/health")
async def health():
    db = get_db()
    try:
        await db.command("ping")
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "success": True,
        "data": {
            "status": "healthy" if db_status == "ok" else "degraded",
            "service": "admin-service",
            "database": db_status,
        },
        "error": None,
    }
