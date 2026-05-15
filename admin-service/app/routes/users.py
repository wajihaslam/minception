from datetime import datetime, timezone, UTC

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.auth.passwords import hash_password
from app.mongo import get_db

router = APIRouter(prefix="/api/admin/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"
    is_active: bool = True


class UserUpdate(BaseModel):
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    for key in ("created_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z") if val.tzinfo is None else val.isoformat().replace("+00:00", "Z")
    return doc


def _oid(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


@router.get("/")
async def list_users(
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    docs = await db.users.find({}).to_list(None)
    return {"success": True, "data": [_serialize(d) for d in docs], "error": None}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db=Depends(get_db),
    _user: dict = Depends(require_role(["admin"])),
):
    existing = await db.users.find_one({"username": body.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    if body.role not in ("admin", "editor", "viewer"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be admin, editor, or viewer",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "username": body.username,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "is_active": body.is_active,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    created = await db.users.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _serialize(created), "error": None}


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    db=Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    if "role" in updates and updates["role"] not in ("admin", "editor", "viewer"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be admin, editor, or viewer",
        )

    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))

    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.users.update_one({"_id": _oid(user_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    doc = await db.users.find_one({"_id": _oid(user_id)})
    return {"success": True, "data": _serialize(doc), "error": None}


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db=Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    if str(current_user.get("_id")) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.users.delete_one({"_id": _oid(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {"success": True, "data": {"id": user_id, "deleted": True}, "error": None}
