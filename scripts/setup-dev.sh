#!/bin/bash
# ============================================================
# Minception — First-Time Developer Setup
# Run once after cloning: ./scripts/setup-dev.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "🌀 Minception — Developer Setup"
echo "=================================="

# Check prerequisites
echo ""
echo "Checking prerequisites..."

check_command() {
  if command -v "$1" &>/dev/null; then
    echo -e "  ${GREEN}✅ $1 found${NC}"
  else
    echo -e "  ${RED}❌ $1 not found — please install it first${NC}"
    exit 1
  fi
}

check_command docker
check_command python3
check_command node
check_command git

# Copy .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "\n${YELLOW}⚠️  Created .env from .env.example — fill in real values before running!${NC}"
else
  echo -e "\n  ${GREEN}✅ .env already exists${NC}"
fi

# Start Docker services
echo ""
echo "Starting Docker services..."
docker compose -f docker-compose.local.yml up -d --build

echo ""
echo "Waiting for MongoDB to be ready..."
sleep 5

# Run migrations
echo ""
echo "Running migrations..."
docker compose -f docker-compose.local.yml exec mock-service \
  python -m migrations.runner --env dev 2>/dev/null || \
  python -m migrations.runner --env dev

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Services running:"
echo "  Mock Service:    http://localhost:8001"
echo "  Mock API docs:   http://localhost:8001/docs"
echo "  Admin Service:   http://localhost:8002"
echo "  Admin API docs:  http://localhost:8002/docs"
echo "  Frontend:        http://localhost:3000"
echo "  Gateway (nginx): http://localhost:80"
echo ""
echo "Default login: admin / changeme123"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 and log in"
echo "  2. Read CLAUDE.md for project context"
echo "  3. Create a feature branch: git checkout -b feature/your-name/feature-name"
