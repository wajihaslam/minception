"""
migrations/runner.py — Minception Migration Runner

Usage:
  python -m migrations.runner --env dev
  python -m migrations.runner --env staging --dry-run
  python -m migrations.runner --env prod

Environment variables required:
  MONGO_DEV_URL, MONGO_STAGING_URL, MONGO_PROD_URL
"""
import asyncio
import importlib
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient


def get_mongo_url(env: str) -> str:
    mapping = {
        "dev": os.getenv("MONGO_DEV_URL", "mongodb://localhost:27017/api_gateway_dev"),
        "staging": os.getenv("MONGO_STAGING_URL"),
        "prod": os.getenv("MONGO_PROD_URL"),
    }
    url = mapping.get(env)
    if not url:
        raise ValueError(f"No MongoDB URL configured for env '{env}'. Set MONGO_{env.upper()}_URL.")
    return url


def discover_migrations() -> list[Path]:
    """Find all migration files in versions/ sorted by number."""
    versions_dir = Path(__file__).parent / "versions"
    files = sorted(versions_dir.glob("[0-9][0-9][0-9]_*.py"))
    return files


async def is_applied(db, migration_id: str) -> bool:
    doc = await db.migration_history.find_one({"migration_id": migration_id, "status": "success"})
    return doc is not None


async def run_migration(db, migration_file: Path, dry_run: bool) -> bool:
    migration_id = migration_file.stem.split("_")[0]
    name = migration_file.stem

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Running migration: {name}")

    # Load module
    spec = importlib.util.spec_from_file_location(name, migration_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, "migrate_up"):
        print(f"  ⚠️  No migrate_up() found in {name} — skipping")
        return False

    start = datetime.utcnow()
    try:
        result = await module.migrate_up(db, dry_run=dry_run)
        duration = (datetime.utcnow() - start).total_seconds() * 1000

        if not dry_run:
            await db.migration_history.insert_one({
                "migration_id": migration_id,
                "name": name,
                "status": "success",
                "applied_at": datetime.utcnow(),
                "duration_ms": int(duration),
                "errors": [],
            })

        print(f"  ✅ {name} completed in {int(duration)}ms")
        if result:
            print(f"     {result}")
        return True

    except Exception as e:
        duration = (datetime.utcnow() - start).total_seconds() * 1000
        print(f"  ❌ {name} FAILED: {e}")

        if not dry_run:
            await db.migration_history.insert_one({
                "migration_id": migration_id,
                "name": name,
                "status": "failed",
                "applied_at": datetime.utcnow(),
                "duration_ms": int(duration),
                "errors": [str(e)],
            })
        return False


async def main(env: str, dry_run: bool):
    mongo_url = get_mongo_url(env)
    db_name = mongo_url.split("/")[-1].split("?")[0]

    print(f"Minception Migration Runner")
    print(f"Environment: {env}")
    print(f"Database:    {db_name}")
    print(f"Dry run:     {dry_run}")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    migrations = discover_migrations()
    print(f"\nFound {len(migrations)} migration(s)")

    applied = 0
    skipped = 0
    failed = 0

    for migration_file in migrations:
        migration_id = migration_file.stem.split("_")[0]

        if await is_applied(db, migration_id):
            print(f"  ⏭️  Skipping {migration_file.stem} (already applied)")
            skipped += 1
            continue

        success = await run_migration(db, migration_file, dry_run)
        if success:
            applied += 1
        else:
            failed += 1
            print("\nAborting: migration failed. Fix the error and re-run.")
            break

    client.close()

    print(f"\n{'─' * 50}")
    print(f"Applied: {applied} | Skipped: {skipped} | Failed: {failed}")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Minception Migration Runner")
    parser.add_argument("--env", choices=["dev", "staging", "prod"], default="dev")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without writing")
    args = parser.parse_args()

    asyncio.run(main(args.env, args.dry_run))
