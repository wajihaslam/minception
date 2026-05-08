#!/usr/bin/env bash
# ==============================================================================
# scripts/run-migrations-dev.sh — Run Minception database migrations (dev only)
#
# WHEN TO RUN:
#   1. Once after your very first `docker compose -f docker-compose.local.yml up`
#   2. After pulling a branch that adds a new file under migrations/versions/
#
# HOW IT WORKS:
#   Executes the migration runner inside the mock-service container, which has
#   the migrations/ directory mounted at /app/migrations. The runner connects
#   to MongoDB using MONGO_DEV_URL (already set in docker-compose.local.yml),
#   skips already-applied migrations, and records results in migration_history.
#
# NEVER run this against staging or prod manually.
#   Bitbucket Pipelines runs migrations automatically on those environments
#   using MONGO_STAGING_URL / MONGO_PROD_URL with the --env flag.
# ==============================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.local.yml"
SERVICE="mock-service"
MAX_WAIT=30
INTERVAL=3

echo ""
echo "=================================================="
echo "  Minception — Dev Migration Runner"
echo "=================================================="
echo ""

# ── 1. Wait for MongoDB to be healthy ─────────────────────────────────────────
echo "Waiting for MongoDB to be healthy (max ${MAX_WAIT}s)..."

elapsed=0
until docker compose -f "$COMPOSE_FILE" exec -T mongodb \
    mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q "1"; do

  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo ""
    echo "ERROR: MongoDB did not become healthy within ${MAX_WAIT}s."
    echo "       Is the stack running? Try:"
    echo "       docker compose -f $COMPOSE_FILE up -d"
    exit 1
  fi

  echo "  MongoDB not ready yet — retrying in ${INTERVAL}s... (${elapsed}s elapsed)"
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo "  MongoDB is healthy."
echo ""

# ── 2. Run migrations ─────────────────────────────────────────────────────────
echo "Running migrations (env=dev)..."
echo ""

if docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
    python -m migrations.runner --env dev; then
  echo ""
  echo "=================================================="
  echo "  SUCCESS: All migrations applied."
  echo "=================================================="
  echo ""
else
  echo ""
  echo "=================================================="
  echo "  FAILURE: One or more migrations failed."
  echo "  Check output above, fix the error, then re-run."
  echo "=================================================="
  echo ""
  exit 1
fi
