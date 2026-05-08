from fastapi import APIRouter, Depends

from app.auth.dependencies import require_role
from app.mongo import get_db

router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_stats(
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin", "editor", "viewer"])),
):
    pipeline = [
        {"$match": {"is_active": True}},
        {
            "$group": {
                "_id": None,
                "active_gateways": {"$sum": 1},
                "total_endpoints": {"$sum": {"$size": "$endpoints"}},
                "total_flavors": {
                    "$sum": {
                        "$sum": {
                            "$map": {
                                "input": "$endpoints",
                                "as": "ep",
                                "in": {"$size": "$$ep.flavors"},
                            }
                        }
                    }
                },
            }
        },
    ]

    total_gateways = await db.gateways.count_documents({})
    agg = await db.gateways.aggregate(pipeline).to_list(1)
    agg_result = agg[0] if agg else {}

    recent_requests = await db.request_logs.count_documents({})

    return {
        "success": True,
        "data": {
            "total_gateways": total_gateways,
            "active_gateways": agg_result.get("active_gateways", 0),
            "total_endpoints": agg_result.get("total_endpoints", 0),
            "total_flavors": agg_result.get("total_flavors", 0),
            "total_requests": recent_requests,
        },
        "error": None,
    }
