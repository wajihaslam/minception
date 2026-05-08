import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_role
from app.models.gateway import EndpointCreate, EndpointUpdate
from app.mongo import get_db
from app.services.reload import trigger_reload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/gateways", tags=["endpoints"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _oid(value: str, label: str = "Resource") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


def _flavor_doc(flavor) -> dict:
    """Serialise a FlavorCreate into a MongoDB sub-document with a fresh _id."""
    d = flavor.model_dump()
    d["_id"] = ObjectId()
    d["is_active"] = True
    return d


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/{gid}/endpoints", status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    gid: str,
    body: EndpointCreate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    now = datetime.now(timezone.utc)
    endpoint_doc = {
        "_id": ObjectId(),
        "path": body.path,
        "method": body.method.upper(),
        "description": body.description,
        "is_active": body.is_active,
        "flavors": [_flavor_doc(f) for f in body.flavors],
        "created_at": now,
    }

    result = await db.gateways.update_one(
        {"_id": _oid(gid, "Gateway")},
        {
            "$push": {"endpoints": endpoint_doc},
            "$set": {"updated_at": now},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")

    await trigger_reload()

    # Return the new endpoint with string ids
    response_doc = {**endpoint_doc, "id": str(endpoint_doc["_id"])}
    response_doc.pop("_id")
    response_doc["flavors"] = [
        {**f, "id": str(f["_id"])} | {"_id": None}
        for f in endpoint_doc["flavors"]
    ]
    for f in response_doc["flavors"]:
        f.pop("_id")

    return {"success": True, "data": response_doc, "error": None}


@router.put("/{gid}/endpoints/{eid}")
async def update_endpoint(
    gid: str,
    eid: str,
    body: EndpointUpdate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    raw = body.model_dump(exclude_none=True)
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    now = datetime.now(timezone.utc)

    # Build $set using arrayFilter variable "ep" for the matched endpoint
    set_fields: dict = {"updated_at": now}
    for field, value in raw.items():
        if field == "method":
            value = value.upper()
        if field == "flavors":
            # Full replacement of the flavors array on the endpoint
            set_fields["endpoints.$[ep].flavors"] = [_flavor_doc(f) for f in body.flavors]
        else:
            set_fields[f"endpoints.$[ep].{field}"] = value

    result = await db.gateways.update_one(
        {"_id": _oid(gid, "Gateway")},
        {"$set": set_fields},
        array_filters=[{"ep._id": _oid(eid, "Endpoint")}],
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    await trigger_reload()

    gateway = await db.gateways.find_one({"_id": _oid(gid, "Gateway")})
    endpoint = next(
        (ep for ep in gateway.get("endpoints", []) if ep["_id"] == _oid(eid, "Endpoint")),
        None,
    )
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    endpoint["id"] = str(endpoint.pop("_id"))
    return {"success": True, "data": endpoint, "error": None}


@router.delete("/{gid}/endpoints/{eid}")
async def delete_endpoint(
    gid: str,
    eid: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    now = datetime.now(timezone.utc)
    result = await db.gateways.update_one(
        {"_id": _oid(gid, "Gateway")},
        {
            "$pull": {"endpoints": {"_id": _oid(eid, "Endpoint")}},
            "$set": {"updated_at": now},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    await trigger_reload()
    return {"success": True, "data": {"id": eid, "deleted": True}, "error": None}
