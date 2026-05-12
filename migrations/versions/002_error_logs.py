"""
002_error_logs.py — Error Logs Collection

Creates:
  - error_logs collection + indexes
  - timestamp: TTL index (configurable via ERROR_LOG_RETENTION_DAYS env var, default 90 days)
  - level, service, error_type, request_id, user_id: single-field indexes
  - message: text index for search

Retention note:
  TTL is baked into the index at creation time. To change retention after creation,
  drop and recreate the index (requires running migrate_down then migrate_up).
"""
import os


async def migrate_up(db, dry_run: bool = False) -> str:
    ops = []
    retention_days = int(os.environ.get("ERROR_LOG_RETENTION_DAYS", "90"))
    existing = await db.list_collection_names()

    if "error_logs" not in existing:
        if not dry_run:
            await db.create_collection("error_logs")
        ops.append("Created error_logs collection")

    if not dry_run:
        await db.error_logs.create_index(
            "timestamp", expireAfterSeconds=retention_days * 86400
        )
        await db.error_logs.create_index("level")
        await db.error_logs.create_index("service")
        await db.error_logs.create_index("error_type")
        await db.error_logs.create_index("request_id")
        await db.error_logs.create_index("user_id")
        await db.error_logs.create_index([("message", "text")])
    ops.append(f"Created error_logs indexes (TTL: {retention_days} days)")

    return " | ".join(ops)


async def migrate_down(db, dry_run: bool = False) -> str:
    if not dry_run:
        await db.drop_collection("error_logs")
    return "Dropped error_logs collection"
