# Deployment Guide — Minception

## Environments

| Environment | Branch | Trigger | MongoDB |
|-------------|--------|---------|---------|
| Local | any | Manual | Local container |
| Staging | `develop` | Auto (Bitbucket Pipelines) | Atlas `api_gateway_staging` |
| Production | `main` | Manual approval | Atlas `api_gateway_prod` |

---

## Local Development

### Prerequisites
- Docker Desktop (running)
- Python 3.11+
- Node.js 18+
- Git

### First-Time Setup
```bash
git clone https://bitbucket.org/simpaisa/minception.git
cd minception
git checkout Sprint0

cp .env.example .env
# Edit .env — fill in MONGO_DEV_URL (get from Wajih)

./scripts/setup-dev.sh
```

### Daily Start
```bash
docker compose -f docker-compose.local.yml up -d
```

### Service URLs
| Service | URL | Docs |
|---------|-----|------|
| Frontend | http://localhost:3000 | — |
| nginx gateway | http://localhost:80 | — |
| Mock Service | http://localhost:8001 | http://localhost:8001/docs |
| Admin Service | http://localhost:8002 | http://localhost:8002/docs |
| MongoDB | localhost:27017 | — |

### Stop / Clean
```bash
# Stop
docker compose -f docker-compose.local.yml down

# Stop + wipe volumes (reset DB)
docker compose -f docker-compose.local.yml down -v
```

---

## Staging Deployment

Staging deploys **automatically** when you push to `develop` via Bitbucket Pipelines.

Pipeline steps:
1. Run tests (mock-service, admin-service, frontend)
2. Build Docker images, tag with commit SHA
3. Push images to Docker registry
4. SSH into staging server, pull images
5. Run migrations (`python -m migrations.runner --env staging`)
6. Start containers, smoke test `/health`

**Bitbucket Pipeline variables required** (set in Bitbucket repo settings):
```
DOCKER_REGISTRY
DOCKER_USERNAME
DOCKER_PASSWORD
MONGO_STAGING_URL
JWT_SECRET
ADMIN_USERNAME
ADMIN_EMAIL
ADMIN_PASSWORD
STAGING_SERVER_IP
STAGING_SSH_USER
```

---

## Production Deployment

Production requires **manual approval** in Bitbucket Pipelines — only Wajih can trigger it.

### Steps
1. Merge `develop` → `main` via PR
2. Bitbucket Pipelines runs tests + builds images automatically
3. Go to Bitbucket → Pipelines → click **Run** on the manual `Deploy to Production` step
4. Monitor: `docker compose -f docker-compose.prod.yml logs -f`

### Pre-deployment checklist
- [ ] Staging has been tested and signed off
- [ ] MongoDB Atlas production backup taken (Atlas auto-backups daily, verify latest)
- [ ] All tests passing in Bitbucket Pipelines
- [ ] SCHEMA-VERSIONS.md up to date
- [ ] All 3 developers notified

### Rollback
```bash
# SSH into production server
docker compose -f docker-compose.prod.yml down
export IMAGE_TAG=<previous-commit-sha>
docker compose -f docker-compose.prod.yml up -d
```

---

## Environment Variables Reference

| Variable | Required In | Description |
|----------|------------|-------------|
| `MONGO_URL` | All | Active MongoDB connection string |
| `MONGO_DEV_URL` | Local/migrations | Dev DB URL |
| `MONGO_STAGING_URL` | Staging | Staging DB URL |
| `MONGO_PROD_URL` | Production | Production DB URL |
| `JWT_SECRET` | Admin Service | Must be long random string in prod |
| `ADMIN_USERNAME` | Admin Service | Bootstrap admin username |
| `ADMIN_EMAIL` | Admin Service | Bootstrap admin email |
| `ADMIN_PASSWORD` | Admin Service | Bootstrap admin password (change immediately!) |
| `MOCK_SERVICE_URL` | Admin Service | Internal URL for /reload calls |
| `FASTAPI_ENV` | All | `development` / `staging` / `production` |

---

## Docker Image Naming

```
minception-mock:latest       Mock Service
minception-admin:latest      Admin Service
minception-frontend:latest   Frontend
```

Tagged by commit SHA on each Bitbucket Pipeline build: `minception-mock:a1b2c3d4`
