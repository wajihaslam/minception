# Schema Versions & Deployment History

> Single source of truth for all schema changes.
> Update this file whenever a migration is created or deployed.

---

## Current Version

- **Schema Version:** v1.0
- **Last Updated:** 2026-05-07
- **Status:** Development (not yet deployed to staging/production)
- **Owner:** Wajih Aslam

---

## Version History

### v1.0 — 2026-05-07 (Initial Schema)

**Migrations Applied:**
- `001_initial_schema`

**Changes:**
- ✅ Created `gateways` collection with indexes on `base_path`, `is_active`, `created_at`
- ✅ Created `users` collection with indexes on `username`, `email`, `is_active`
- ✅ Created `request_logs` collection with TTL index (90-day auto-delete)
- ✅ Created `migration_history` collection
- ✅ Created default admin user (username: admin)
- ✅ Created sample gateway at `/api/v1`

**Deployed To:**
- Production: Not yet
- Staging: Not yet
- Local: Run `python -m migrations.runner --env dev`

---

## Pending Migrations

*None at this time.*

---

## Schema Compatibility Matrix

| Schema | Mock Service | Admin Service | Frontend | Notes |
|--------|-------------|---------------|----------|-------|
| v1.0   | v1.0        | v1.0          | v1.0     | Initial release |

---

## How to Add a New Migration

1. Create file: `migrations/versions/002_your_description.py`
2. Implement both `migrate_up(db, dry_run)` and `migrate_down(db, dry_run)`
3. Test locally: `python -m migrations.runner --env dev --dry-run`
4. If dry run OK: `python -m migrations.runner --env dev`
5. Update this file — add entry under "Pending Migrations"
6. Commit: `git commit -m "feat: add X field [migration: 002]"`
7. After staging deploy: move from "Pending" to "Version History"

---

## Migration File Template

```python
# migrations/versions/002_your_description.py

async def migrate_up(db, dry_run: bool = False) -> str:
    ops = []
    # Your migration logic here
    if not dry_run:
        await db.your_collection.update_many({}, {"$set": {"new_field": "default"}})
    ops.append("Added new_field to your_collection")
    return " | ".join(ops)

async def migrate_down(db, dry_run: bool = False) -> str:
    ops = []
    if not dry_run:
        await db.your_collection.update_many({}, {"$unset": {"new_field": ""}})
    ops.append("Removed new_field from your_collection")
    return " | ".join(ops)
```
