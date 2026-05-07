from fastapi import APIRouter
from app import engine as eng
from app.mongo import get_db
import time

router = APIRouter(tags=["health"])

_start_time = time.time()


@router.get("/health")
async def health():
    db = get_db()
    try:
        await db.command("ping")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "service": "mock-service",
        "uptime_seconds": round(time.time() - _start_time),
        "configs_loaded": len(eng.get_configs()),
        "database": db_status,
    }
