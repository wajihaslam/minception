import logging
from datetime import datetime, timezone

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user, require_role
from app.config import settings
from app.models.gateway import GatewayCreate, GatewayUpdate
from app.mongo import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/gateways", tags=["gateways"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-safe dict (ObjectId → str)."""
    doc["id"] = str(doc.pop("_id"))
    return doc


async def _reload_mock_service() -> None:
    """Signal mock-service to reload configs. Fire-and-forget."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{settings.MOCK_SERVICE_URL}/reload")
    except Exception as exc:
        logger.warning("Mock service reload failed: %s", exc)


def _bad_id():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")


def _oid(gateway_id: str) -> ObjectId:
    try:
        return ObjectId(gateway_id)
    except Exception:
        _bad_id()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_gateways(
    active: bool | None = Query(None, alias="active"),
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor", "viewer"])),
):
    query: dict = {}
    if active is not None:
        query["is_active"] = active

    docs = await db.gateways.find(query).to_list(None)
    return {"success": True, "data": [_serialize(d) for d in docs], "error": None}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_gateway(
    body: GatewayCreate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    now = datetime.now(timezone.utc)
    doc = {
        **body.model_dump(),
        "endpoints": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.gateways.insert_one(doc)
    created = await db.gateways.find_one({"_id": result.inserted_id})
    await _reload_mock_service()
    return {"success": True, "data": _serialize(created), "error": None}


@router.get("/{gateway_id}")
async def get_gateway(
    gateway_id: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor", "viewer"])),
):
    doc = await db.gateways.find_one({"_id": _oid(gateway_id)})
    if not doc:
        _bad_id()
    return {"success": True, "data": _serialize(doc), "error": None}


@router.put("/{gateway_id}")
async def update_gateway(
    gateway_id: str,
    body: GatewayUpdate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.gateways.update_one({"_id": _oid(gateway_id)}, {"$set": updates})
    if result.matched_count == 0:
        _bad_id()

    doc = await db.gateways.find_one({"_id": _oid(gateway_id)})
    await _reload_mock_service()
    return {"success": True, "data": _serialize(doc), "error": None}


@router.delete("/{gateway_id}")
async def delete_gateway(
    gateway_id: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    result = await db.gateways.update_one(
        {"_id": _oid(gateway_id)},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        _bad_id()

    await _reload_mock_service()
    return {"success": True, "data": {"id": gateway_id, "is_active": False}, "error": None}
