# Migrations Guide — Minception

## Overview

Minception uses a custom async migration runner (`migrations/runner.py`) built on Motor (async MongoDB driver).

Migrations are plain Python files in `migrations/versions/`, numbered sequentially: `001_`, `002_`, `003_`...

The runner tracks what's been applied in a `migration_history` MongoDB collection — it will never run the same migration twice.

---

## Running Migrations

```bash
# Local (default)
python -m migrations.runner --env dev

# Dry run (simulate without writing anything)
python -m migrations.runner --env dev --dry-run

# Staging
python -m migrations.runner --env staging

# Production (only Wajih runs this — Pipelines does it automatically)
python -m migrations.runner --env prod
```

**Always do a `--dry-run` first on staging and production.**

---

## Creating a New Migration

### Step 1 — Coordinate
Post in Slack: *"Taking migration number 002 — no conflicts?"*
This avoids two developers creating `002_` at the same time.

### Step 2 — Create the file
```bash
touch migrations/versions/002_your_description.py
```

### Step 3 — Fill in the template

```python
"""
002_your_description.py — Brief description of what this migration does
"""

async def migrate_up(db, dry_run: bool = False) -> str:
    """Apply the migration."""
    ops = []

    # Example: add a new field to all gateways
    if not dry_run:
        result = await db.gateways.update_many(
            {"new_field": {"$exists": False}},
            {"$set": {"new_field": "default_value"}}
        )
        ops.append(f"Added new_field to {result.modified_count} gateways")
    else:
        count = await db.gateways.count_documents({"new_field": {"$exists": False}})
        ops.append(f"[DRY RUN] Would update {count} gateways")

    return " | ".join(ops)


async def migrate_down(db, dry_run: bool = False) -> str:
    """Roll back the migration."""
    ops = []

    if not dry_run:
        result = await db.gateways.update_many(
            {},
            {"$unset": {"new_field": ""}}
        )
        ops.append(f"Removed new_field from {result.modified_count} gateways")
    else:
        ops.append("[DRY RUN] Would remove new_field from all gateways")

    return " | ".join(ops)
```

### Step 4 — Test locally
```bash
# Dry run first
python -m migrations.runner --env dev --dry-run

# If clean, apply
python -m migrations.runner --env dev
```

### Step 5 — Update SCHEMA-VERSIONS.md
Add your migration to the "Pending Migrations" section.

### Step 6 — Commit
```bash
git add migrations/versions/002_your_description.py SCHEMA-VERSIONS.md
git commit -m "feat(schema): add new_field to gateways [migration: 002]"
```

Bitbucket Pipelines runs the migration automatically on staging when your PR merges to `develop`.

---

## Migration Rules

| Rule | Why |
|------|-----|
| Always write both `migrate_up()` and `migrate_down()` | Enables rollback |
| Always support `dry_run=True` | Required for pre-production checks |
| Never drop a field without a deprecation period | Could break running services |
| Never rename a field in one step | Split into: add new → backfill → remove old |
| Migrations are append-only — never edit an applied migration | Runner uses file number to track state |
| Test on dev before committing | Jenkins/Pipelines will fail otherwise |

---

## Common MongoDB Migration Patterns

### Add a field with default value
```python
await db.collection.update_many(
    {"new_field": {"$exists": False}},
    {"$set": {"new_field": "default"}}
)
```

### Create an index
```python
await db.collection.create_index("field_name")
await db.collection.create_index([("field1", 1), ("field2", -1)])  # compound
await db.collection.create_index("email", unique=True)
```

### Add field to embedded array documents
```python
await db.gateways.update_many(
    {},
    {"$set": {"endpoints.$[].new_field": "default"}}
)
```

### Rename a field (safe two-step process)
```python
# Step 1 (migration 005): add new field, copy data from old
await db.collection.update_many({}, [
    {"$set": {"new_name": "$old_name"}}
])

# Step 2 (migration 006, later sprint): remove old field
await db.collection.update_many({}, {"$unset": {"old_name": ""}})
```

### Drop a collection (dangerous — use with caution)
```python
if not dry_run:
    await db.drop_collection("old_collection")
```

---

## Checking Migration History

```bash
# Connect to MongoDB (local)
mongosh mongodb://localhost:27017/api_gateway_dev

# See all applied migrations
db.migration_history.find().sort({applied_at: -1}).pretty()

# Check if specific migration was applied
db.migration_history.findOne({migration_id: "002", status: "success"})
```

---

## What Pipelines Does Automatically

| Event | Action |
|-------|--------|
| PR merged to `develop` | Runs `python -m migrations.runner --env staging` |
| Manual prod deploy approved | Runs `python -m migrations.runner --env prod` |
| Migration fails | Pipeline aborts, sends alert, does NOT deploy |

---

## Applied Migrations

| ID | Name | Status | Date |
|----|------|--------|------|
| 001 | initial_schema | ✅ Pending local run | 2026-05-07 |

*(Update this table after each migration is applied to production)*
