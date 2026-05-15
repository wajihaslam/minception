from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import require_role
from app.mongo import get_db

router = APIRouter(prefix="/api/admin/logs", tags=["logs"])


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/")
async def list_logs(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    method: str | None = Query(None),
    matched: bool | None = Query(None),
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor", "viewer"])),
):
    query: dict = {}
    if method:
        query["method"] = method.upper()
    if matched is not None:
        query["matched"] = matched

    cursor = db.request_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)
    total = await db.request_logs.count_documents(query)

    return {
        "success": True,
        "data": {
            "logs": [_serialize(d) for d in docs],
            "total": total,
            "limit": limit,
            "skip": skip,
        },
        "error": None,
    }


@router.delete("/")
async def clear_all_logs(
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    result = await db.request_logs.delete_many({})
    return {"success": True, "data": {"deleted_count": result.deleted_count}, "error": None}


@router.get("/{log_id}")
async def get_log(
    log_id: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor", "viewer"])),
):
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")

    doc = await db.request_logs.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")

    return {"success": True, "data": _serialize(doc), "error": None}
