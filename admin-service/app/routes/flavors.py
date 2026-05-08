from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_role
from app.models.gateway import FlavorCreate, FlavorUpdate
from app.mongo import get_db
from app.services.reload import trigger_reload

router = APIRouter(prefix="/api/admin/gateways", tags=["flavors"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _oid(value: str, label: str = "Resource") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/{gid}/endpoints/{eid}/flavors", status_code=status.HTTP_201_CREATED)
async def create_flavor(
    gid: str,
    eid: str,
    body: FlavorCreate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    flavor_doc = {
        "_id": ObjectId(),
        "is_active": True,
        **body.model_dump(),
    }

    result = await db.gateways.update_one(
        {
            "_id": _oid(gid, "Gateway"),
            "endpoints._id": _oid(eid, "Endpoint"),
        },
        {
            "$push": {"endpoints.$[ep].flavors": flavor_doc},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        array_filters=[{"ep._id": _oid(eid, "Endpoint")}],
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway or endpoint not found")

    await trigger_reload()

    response_doc = {**flavor_doc, "id": str(flavor_doc["_id"])}
    response_doc.pop("_id")
    return {"success": True, "data": response_doc, "error": None}


@router.put("/{gid}/endpoints/{eid}/flavors/{fid}")
async def update_flavor(
    gid: str,
    eid: str,
    fid: str,
    body: FlavorUpdate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    raw = body.model_dump(exclude_none=True)
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    # Build $set using nested arrayFilter variables: ep → endpoint, fl → flavor
    set_fields: dict = {"updated_at": datetime.now(timezone.utc)}
    for field, value in raw.items():
        if isinstance(value, dict):
            # Flatten nested model dicts (match, response) field-by-field
            # to avoid overwriting sibling keys not present in the update
            for sub_field, sub_value in value.items():
                set_fields[f"endpoints.$[ep].flavors.$[fl].{field}.{sub_field}"] = sub_value
        else:
            set_fields[f"endpoints.$[ep].flavors.$[fl].{field}"] = value

    result = await db.gateways.update_one(
        {"_id": _oid(gid, "Gateway")},
        {"$set": set_fields},
        array_filters=[
            {"ep._id": _oid(eid, "Endpoint")},
            {"fl._id": _oid(fid, "Flavor")},
        ],
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint or flavor not found")

    await trigger_reload()

    # Return the updated flavor by projecting it out of the gateway doc
    gateway = await db.gateways.find_one({"_id": _oid(gid, "Gateway")})
    endpoint = next(
        (ep for ep in gateway.get("endpoints", []) if ep["_id"] == _oid(eid, "Endpoint")),
        None,
    )
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    flavor = next(
        (fl for fl in endpoint.get("flavors", []) if fl["_id"] == _oid(fid, "Flavor")),
        None,
    )
    if not flavor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flavor not found")

    flavor["id"] = str(flavor.pop("_id"))
    return {"success": True, "data": flavor, "error": None}


@router.delete("/{gid}/endpoints/{eid}/flavors/{fid}")
async def delete_flavor(
    gid: str,
    eid: str,
    fid: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor"])),
):
    result = await db.gateways.update_one(
        {
            "_id": _oid(gid, "Gateway"),
            "endpoints._id": _oid(eid, "Endpoint"),
        },
        {
            "$pull": {"endpoints.$[ep].flavors": {"_id": _oid(fid, "Flavor")}},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        array_filters=[{"ep._id": _oid(eid, "Endpoint")}],
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway or endpoint not found")
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flavor not found")

    await trigger_reload()
    return {"success": True, "data": {"id": fid, "deleted": True}, "error": None}
