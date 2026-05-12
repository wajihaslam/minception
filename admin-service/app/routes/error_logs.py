import re
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import require_role
from app.mongo import get_db

router = APIRouter(prefix="/api/admin/error-logs", tags=["error-logs"])

_ALLOWED_SORT = {"timestamp", "level", "service", "error_type"}


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _default_start() -> datetime:
    return (
        datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        - timedelta(days=5)
    )


def _default_end() -> datetime:
    return datetime.now(timezone.utc).replace(
        hour=23, minute=59, second=59, microsecond=999999
    )


def _parse_dt(val: str | None, default: datetime) -> datetime:
    if not val:
        return default
    try:
        dt = datetime.fromisoformat(val)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DATE", "message": f"Invalid date: {val}"},
        )


@router.get("/")
async def list_error_logs(
    search: str | None = Query(None),
    levels: list[str] = Query(default=[]),
    error_types: list[str] = Query(default=[]),
    services: list[str] = Query(default=[]),
    request_id: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort_by: str = Query("timestamp"),
    sort_order: str = Query("desc"),
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    sort_field = sort_by if sort_by in _ALLOWED_SORT else "timestamp"
    sort_dir = -1 if sort_order != "asc" else 1

    start = _parse_dt(start_date, _default_start())
    end = _parse_dt(end_date, _default_end())

    if (end - start).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "DATE_RANGE_TOO_LARGE",
                "message": "Date range cannot exceed 90 days",
            },
        )

    match: dict = {"timestamp": {"$gte": start, "$lte": end}}

    if search:
        match["message"] = {"$regex": re.escape(search), "$options": "i"}
    if levels:
        match["level"] = {"$in": [lv.upper() for lv in levels]}
    if error_types:
        match["error_type"] = {"$in": error_types}
    if services:
        match["service"] = {"$in": services}
    if request_id:
        match["request_id"] = request_id

    skip = (page - 1) * page_size

    pipeline = [
        {"$match": match},
        {
            "$facet": {
                "logs": [
                    {"$sort": {sort_field: sort_dir}},
                    {"$skip": skip},
                    {"$limit": page_size},
                ],
                "total": [{"$count": "count"}],
                "error_type_facets": [
                    {"$match": {"error_type": {"$ne": None}}},
                    {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                    {"$limit": 20},
                ],
                "service_facets": [
                    {"$group": {"_id": "$service", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                ],
                "level_facets": [
                    {"$group": {"_id": "$level", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                ],
            }
        },
    ]

    result = await db.error_logs.aggregate(pipeline).to_list(1)
    fd = result[0] if result else {}

    total = fd.get("total", [{}])[0].get("count", 0) if fd.get("total") else 0
    logs = [_serialize(d) for d in fd.get("logs", [])]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "success": True,
        "data": {
            "logs": logs,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            },
            "facets": {
                "error_types": [
                    {"value": f["_id"], "count": f["count"]}
                    for f in fd.get("error_type_facets", [])
                ],
                "services": [
                    {"value": f["_id"], "count": f["count"]}
                    for f in fd.get("service_facets", [])
                ],
                "levels": [
                    {"value": f["_id"], "count": f["count"]}
                    for f in fd.get("level_facets", [])
                ],
            },
        },
        "error": None,
    }


@router.get("/{log_id}")
async def get_error_log(
    log_id: str,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Log not found"
        )

    doc = await db.error_logs.find_one({"_id": oid})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Log not found"
        )

    return {"success": True, "data": _serialize(doc), "error": None}
