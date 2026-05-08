"""
001_initial_schema.py — Minception Initial Schema

Creates:
  - gateways collection + indexes
  - users collection + indexes
  - request_logs collection + indexes
  - migration_history collection
  - Default admin user
"""
from datetime import datetime
import bcrypt


async def migrate_up(db, dry_run: bool = False) -> str:
    ops = []

    # ── gateways ──────────────────────────────────────────────
    existing = await db.list_collection_names()

    if "gateways" not in existing:
        if not dry_run:
            await db.create_collection("gateways")
        ops.append("Created gateways collection")

    if not dry_run:
        await db.gateways.create_index("base_path", unique=True)
        await db.gateways.create_index("is_active")
        await db.gateways.create_index("created_at")
    ops.append("Created gateways indexes")

    # ── users ─────────────────────────────────────────────────
    if "users" not in existing:
        if not dry_run:
            await db.create_collection("users")
        ops.append("Created users collection")

    if not dry_run:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True)
        await db.users.create_index("is_active")
    ops.append("Created users indexes")

    # ── request_logs ──────────────────────────────────────────
    if "request_logs" not in existing:
        if not dry_run:
            await db.create_collection("request_logs")
        ops.append("Created request_logs collection")

    if not dry_run:
        # TTL index on timestamp — auto-delete logs older than 90 days.
        # Also serves as the sort index; do NOT create a separate plain
        # index on timestamp or MongoDB will raise IndexOptionsConflict.
        await db.request_logs.create_index(
            "timestamp", expireAfterSeconds=60 * 60 * 24 * 90
        )
        await db.request_logs.create_index("endpoint_path")
        await db.request_logs.create_index("method")
        await db.request_logs.create_index("matched")
    ops.append("Created request_logs indexes (with 90-day TTL)")

    # ── migration_history ─────────────────────────────────────
    if "migration_history" not in existing:
        if not dry_run:
            await db.create_collection("migration_history")
        ops.append("Created migration_history collection")

    # ── Default admin user ────────────────────────────────────
    if not dry_run:
        existing_admin = await db.users.find_one({"username": "admin"})
        if not existing_admin:
            password_hash = bcrypt.hashpw(b"changeme123", bcrypt.gensalt()).decode("utf-8")
            await db.users.insert_one({
                "username": "admin",
                "email": "admin@simpaisa.com",
                "password_hash": password_hash,
                "role": "admin",
                "is_active": True,
                "created_at": datetime.utcnow(),
            })
            ops.append("Created default admin user (username: admin, password: changeme123)")

    # ── Sample gateway (dev seed) ─────────────────────────────
    if not dry_run:
        existing_gw = await db.gateways.find_one({"base_path": "/api/v1"})
        if not existing_gw:
            await db.gateways.insert_one({
                "name": "Sample Payment Gateway",
                "base_path": "/api/v1",
                "description": "Sample gateway — delete or modify as needed",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "endpoints": [
                    {
                        "path": "/users/create",
                        "method": "POST",
                        "description": "Create user mock",
                        "is_active": True,
                        "flavors": [
                            {
                                "name": "Success",
                                "priority": 0,
                                "is_default": True,
                                "is_active": True,
                                "match": {},
                                "response": {
                                    "status": 200,
                                    "headers": {"Content-Type": "application/json"},
                                    "body": {"success": True, "userId": "{{uuid}}"},
                                    "delay_ms": 0,
                                },
                            },
                            {
                                "name": "Server Error",
                                "priority": 5,
                                "is_default": False,
                                "is_active": True,
                                "match": {
                                    "headers": {"X-Force-Error": "500"},
                                    "body": {},
                                    "query": {},
                                },
                                "response": {
                                    "status": 500,
                                    "headers": {"Content-Type": "application/json"},
                                    "body": {"error": "Internal Server Error"},
                                    "delay_ms": 0,
                                },
                            },
                        ],
                    }
                ],
            })
            ops.append("Created sample gateway (/api/v1)")

    return " | ".join(ops)


async def migrate_down(db, dry_run: bool = False) -> str:
    """
    Rollback: drops all collections created by this migration.
    WARNING: This deletes all data. Use with caution.
    """
    ops = []
    collections = ["gateways", "users", "request_logs", "migration_history"]

    for col in collections:
        if not dry_run:
            await db.drop_collection(col)
        ops.append(f"Dropped {col}")

    return " | ".join(ops)
