import copy
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user, require_role
from app.models.gateway import GatewayCreate, GatewayUpdate
from app.mongo import get_db
from app.services.reload import trigger_reload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/gateways", tags=["gateways"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-safe dict (ObjectId → str), recursively."""
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            doc[key] = str(value)
        elif isinstance(value, list):
            doc[key] = [_serialize(i) if isinstance(i, dict) else i for i in value]
        elif isinstance(value, dict):
            doc[key] = _serialize(value)
    return doc


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
    await trigger_reload()
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
    await trigger_reload()
    return {"success": True, "data": _serialize(doc), "error": None}


@router.put("/{gateway_id}/raw")
async def update_gateway_raw(
    gateway_id: str,
    body: dict,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    """
    Full document replacement from the JSON editor.
    Accepts the gateway JSON (with nested endpoints/flavors).
    Converts 'id' → ObjectId '_id' recursively, preserves _id and created_at.
    """
    oid = _oid(gateway_id)
    existing = await db.gateways.find_one({"_id": oid})
    if not existing:
        _bad_id()

    def _to_oid(val: str):
        try:
            return ObjectId(val)
        except Exception:
            return ObjectId()

    def _deserialize(obj):
        if isinstance(obj, dict):
            result = {}
            for k, v in obj.items():
                if k == "id" and isinstance(v, str):
                    result["_id"] = _to_oid(v)
                else:
                    result[k] = _deserialize(v)
            return result
        if isinstance(obj, list):
            return [_deserialize(i) for i in obj]
        return obj

    doc = _deserialize(body)
    doc["_id"] = oid
    doc["created_at"] = existing["created_at"]
    doc["updated_at"] = datetime.now(timezone.utc)

    await db.gateways.replace_one({"_id": oid}, doc)
    updated = await db.gateways.find_one({"_id": oid})
    await trigger_reload()
    return {"success": True, "data": _serialize(updated), "error": None}


@router.post("/{gateway_id}/endpoints/{endpoint_id}/copy", status_code=status.HTTP_201_CREATED)
async def copy_endpoint(
    gateway_id: str,
    endpoint_id: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    doc = await db.gateways.find_one({"_id": _oid(gateway_id)})
    if not doc:
        _bad_id()

    try:
        eid = ObjectId(endpoint_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    source = next((e for e in doc.get("endpoints", []) if e["_id"] == eid), None)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    # Build the new endpoint explicitly to avoid deepcopy issues with Motor BSON types
    new_flavors = []
    for f in source.get("flavors", []):
        new_f = copy.deepcopy(f)
        new_f["_id"] = ObjectId()
        new_flavors.append(new_f)

    new_ep = {
        "_id": ObjectId(),
        "path": source["path"] + " (copy)",
        "method": source.get("method", "GET"),
        "description": source.get("description", ""),
        "is_active": source.get("is_active", True),
        "flavors": new_flavors,
    }

    # Use $set on the full endpoints array — more reliable than $push for nested docs
    updated_endpoints = list(doc.get("endpoints", [])) + [new_ep]
    await db.gateways.update_one(
        {"_id": _oid(gateway_id)},
        {"$set": {"endpoints": updated_endpoints, "updated_at": datetime.now(timezone.utc)}},
    )
    await trigger_reload()
    return {"success": True, "data": _serialize(new_ep), "error": None}


@router.post("/{gateway_id}/endpoints/{endpoint_id}/flavors/{flavor_id}/copy", status_code=status.HTTP_201_CREATED)
async def copy_flavor(
    gateway_id: str,
    endpoint_id: str,
    flavor_id: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    doc = await db.gateways.find_one({"_id": _oid(gateway_id)})
    if not doc:
        _bad_id()

    try:
        eid = ObjectId(endpoint_id)
        fid = ObjectId(flavor_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    source_ep = next((e for e in doc.get("endpoints", []) if e["_id"] == eid), None)
    if not source_ep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    source_flavor = next((f for f in source_ep.get("flavors", []) if f["_id"] == fid), None)
    if not source_flavor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flavor not found")

    new_flavor = copy.deepcopy(source_flavor)
    new_flavor["_id"] = ObjectId()
    new_flavor["name"] = source_flavor["name"] + " (copy)"
    new_flavor["is_default"] = False

    # Append new flavor to the target endpoint's flavors list via $set on the full endpoints array
    updated_endpoints = []
    for ep in doc.get("endpoints", []):
        if ep["_id"] == eid:
            ep = copy.deepcopy(ep)
            ep["flavors"] = list(ep.get("flavors", [])) + [new_flavor]
        updated_endpoints.append(ep)

    await db.gateways.update_one(
        {"_id": _oid(gateway_id)},
        {"$set": {"endpoints": updated_endpoints, "updated_at": datetime.now(timezone.utc)}},
    )
    await trigger_reload()
    return {"success": True, "data": _serialize(new_flavor), "error": None}


@router.delete("/")
async def delete_all_gateways(
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    result = await db.gateways.delete_many({})
    await trigger_reload()
    return {"success": True, "data": {"deleted_count": result.deleted_count}, "error": None}


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

    await trigger_reload()
    return {"success": True, "data": {"id": gateway_id, "is_active": False}, "error": None}
