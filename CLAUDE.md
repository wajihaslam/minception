# Minception — Claude Code Context

> **Project:** Minception — API Mock Gateway platform  
> **Repo:** github.com/wajihaslam/minception (monorepo)  
> **Stack:** Python/FastAPI · MongoDB Atlas · React/TypeScript · Docker · nginx  
> **Team:** 3 developers | **Owner:** Wajih Aslam (wajih.aslam@gmail.com)

---

## Architecture Overview

```
nginx (port 80/443)
 ├── /mock/* /gateway/*   → mock-service  (port 8001) — FastAPI, Python
 ├── /api/admin/* /api/auth/*  → admin-service (port 8002) — FastAPI, Python
 └── /* (default)         → frontend      (port 3000) — React + TypeScript
                                    ↕
                           MongoDB Atlas (shared)
                           api_gateway_dev / staging / prod
```

**Architecture Decision:** Microservices v3 — 3 independent services, 1 shared MongoDB cluster.  
Mock Service is **stateless + read-only** against MongoDB (single query per request, optional in-memory cache).  
Admin Service owns all **writes**, JWT auth, and signals Mock Service to reload configs on change.

---

## Repository Structure

```
minception/                      ← Monorepo root
├── CLAUDE.md                        ← YOU ARE HERE
├── AGENTS.md                        ← Codex/OpenAI Codex context
├── .cursorrules                     ← Cursor IDE rules
├── .windsurfrules                   ← Windsurf rules
├── README.md
├── .gitignore
├── .env.example
├── .dockerignore
│
├── mock-service/                    ← Service 1: Mock request handler
│   ├── app/
│   │   ├── main.py                  ← FastAPI app entry point
│   │   ├── engine.py                ← Route matching + flavor selection
│   │   ├── mongo.py                 ← Async MongoDB connection (motor)
│   │   ├── models.py                ← Pydantic models
│   │   ├── config.py                ← Settings from env vars
│   │   └── routes/
│   │       └── health.py            ← GET /health
│   ├── app/tests/
│   │   ├── test_engine.py
│   │   └── test_matching.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── admin-service/                   ← Service 2: CRUD + Auth + Dashboard
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── mongo.py
│   │   ├── auth/
│   │   │   ├── jwt.py               ← Token create/validate
│   │   │   ├── passwords.py         ← bcrypt hash/verify
│   │   │   └── dependencies.py      ← FastAPI deps: require_auth, require_role
│   │   ├── routes/
│   │   │   ├── auth.py              ← POST /login /refresh, GET /me
│   │   │   ├── gateways.py          ← CRUD /api/admin/gateways
│   │   │   ├── endpoints.py         ← CRUD /api/admin/gateways/:id/endpoints
│   │   │   ├── flavors.py           ← CRUD .../endpoints/:id/flavors
│   │   │   ├── users.py             ← CRUD /api/admin/users (admin only)
│   │   │   ├── dashboard.py         ← GET /api/admin/dashboard/stats
│   │   │   └── logs.py              ← GET /api/admin/logs
│   │   └── models/
│   │       ├── gateway.py           ← Pydantic schemas
│   │       ├── user.py
│   │       └── log.py
│   ├── app/tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                        ← Service 3: React Admin Dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   ├── services/api.ts          ← Axios + JWT interceptor
│   │   ├── context/AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Gateways.tsx
│   │   │   ├── EndpointEditor.tsx   ← Endpoints + flavors together
│   │   │   ├── Logs.tsx
│   │   │   └── Users.tsx
│   │   └── components/
│   │       ├── Layout.tsx
│   │       ├── ProtectedRoute.tsx
│   │       ├── FlavorCard.tsx
│   │       └── JsonEditor.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── migrations/                      ← Shared schema migrations
│   ├── __init__.py
│   ├── runner.py                    ← Orchestrator — run with: python -m migrations.runner
│   ├── versions/
│   │   └── 001_initial_schema.py    ← Creates gateways, users, request_logs collections
│   └── seeds/
│       ├── development.py
│       └── staging.py
│
├── nginx/
│   ├── nginx.conf                   ← Main nginx config
│   └── conf.d/
│       └── api-gateway.conf         ← Upstream routing rules
│
├── scripts/
│   ├── setup-dev.sh                 ← First-time dev setup
│   ├── run-migrations.sh
│   └── backup.sh
│
├── jenkins/
│   ├── Jenkinsfile                  ← CI/CD pipeline
│   └── scripts/
│       ├── build.sh
│       ├── test.sh
│       └── deploy.sh
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── MIGRATIONS.md
│   └── TEAM-WORKFLOW.md
│
├── docker-compose.local.yml
├── docker-compose.staging.yml
├── docker-compose.prod.yml
├── SCHEMA-VERSIONS.md
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Tech Stack (Locked — Do Not Change Without Team Discussion)

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Language | Python | 3.11+ |
| Backend Framework | FastAPI | latest stable |
| Async DB Driver | motor | latest |
| Sync DB Driver | pymongo | latest |
| Data Validation | Pydantic v2 | latest |
| Authentication | PyJWT + bcrypt | latest |
| Frontend Framework | React | 18.x |
| Frontend Language | TypeScript | 5.x |
| Frontend Build | Vite | latest |
| CSS | Tailwind CSS | 3.x |
| UI Components | Shadcn/ui | latest |
| State/Data | React Query (TanStack) | v5 |
| Routing | React Router | v6 |
| Database | MongoDB Atlas | M0 free tier |
| Containerisation | Docker + Compose | v3+ |
| Reverse Proxy | nginx | 1.24+ |
| CI/CD | GitHub Actions | — |

---

## MongoDB Data Model

**Embedded document strategy** — gateways contain endpoints, endpoints contain flavors.  
One MongoDB read for the entire mock hot path.

```javascript
// Collection: gateways
{
  _id: ObjectId,
  name: String,
  base_path: String,        // e.g. "/api/v1"
  description: String,
  is_active: Boolean,
  created_at: Date,
  updated_at: Date,
  endpoints: [
    {
      _id: ObjectId,
      path: String,           // e.g. "/users/create"
      method: String,         // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
      description: String,
      is_active: Boolean,
      flavors: [
        {
          _id: ObjectId,
          name: String,
          priority: Number,   // higher = matched first
          is_default: Boolean,
          match: {
            headers: Object,  // regex patterns: {"Authorization": "Bearer admin_.*"}
            body: Object,     // jsonpath: {"$.role": "admin"}
            query: Object     // exact/regex: {"page": "1"}
          },
          response: {
            status: Number,
            headers: Object,
            body: Object,
            delay_ms: Number
          }
        }
      ]
    }
  ]
}

// Collection: users
{ _id, username, email, password_hash, role, is_active, created_at }
// role: "admin" | "editor" | "viewer"

// Collection: request_logs
{ _id, gateway_id, endpoint_path, method, matched_flavor, request, response, client_ip, timestamp }
```

---

## API Design

### Mock Service (port 8001)
```
ANY  /mock/{base_path}/{path}    → Match gateway → endpoint → flavor → return response
GET  /health                     → { status, configs_loaded, uptime }
POST /reload                     → Reload all configs from MongoDB (called by Admin Service)
```

### Admin Service (port 8002)
```
# Auth
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me

# Gateways (JWT required)
GET    /api/admin/gateways
POST   /api/admin/gateways
GET    /api/admin/gateways/:id
PUT    /api/admin/gateways/:id
DELETE /api/admin/gateways/:id

# Endpoints (nested)
POST   /api/admin/gateways/:gid/endpoints
PUT    /api/admin/gateways/:gid/endpoints/:eid
DELETE /api/admin/gateways/:gid/endpoints/:eid

# Flavors (nested)
POST   /api/admin/gateways/:gid/endpoints/:eid/flavors
PUT    /api/admin/gateways/:gid/endpoints/:eid/flavors/:fid
DELETE /api/admin/gateways/:gid/endpoints/:eid/flavors/:fid

# Dashboard & Logs
GET    /api/admin/dashboard/stats
GET    /api/admin/logs
GET    /api/admin/logs/:id

# Users (admin role only)
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
```

### Standard API Response Format
**ALL endpoints must return this shape:**
```json
{
  "success": true,
  "data": {},
  "error": null
}
```
On error:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "Gateway not found" }
}
```

---

## Auth

- JWT access tokens (short-lived: 60 min)
- JWT refresh tokens (long-lived: 7 days)
- Roles: `admin` > `editor` > `viewer`
- FastAPI dependency pattern:

```python
from admin_service.app.auth.dependencies import require_role

@router.post("/gateways")
async def create_gateway(data: GatewayCreate, user=Depends(require_role(["admin", "editor"]))):
    ...
```

---

## Key Commands

### Local Development
```bash
# Start everything (Docker)
docker compose -f docker-compose.local.yml up --build

# Start individual services (no Docker)
cd mock-service && uvicorn app.main:app --reload --port 8001
cd admin-service && uvicorn app.main:app --reload --port 8002
cd frontend && npm run dev   # port 3000

# Run migrations
python -m migrations.runner --env dev

# Run tests
cd mock-service && pytest app/tests/ -v
cd admin-service && pytest app/tests/ -v

# Seed sample data
python migrations/seeds/development.py
```

### Docker Commands
```bash
docker compose -f docker-compose.local.yml up -d        # Start
docker compose -f docker-compose.local.yml down          # Stop
docker compose -f docker-compose.local.yml logs -f       # Logs
docker compose -f docker-compose.local.yml down -v       # Clean volumes
```

### Useful URLs (local)
- Mock Service API docs: http://localhost:8001/docs
- Admin Service API docs: http://localhost:8002/docs
- Frontend dashboard: http://localhost:3000
- nginx gateway: http://localhost:80

---

## Environment Variables

```bash
# MongoDB
MONGO_DEV_URL=mongodb+srv://user:pass@cluster.mongodb.net/api_gateway_dev
MONGO_STAGING_URL=mongodb+srv://user:pass@cluster.mongodb.net/api_gateway_staging
MONGO_PROD_URL=mongodb+srv://user:pass@cluster.mongodb.net/api_gateway_prod

# Auth (Admin Service)
JWT_SECRET=change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin Service
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123
MOCK_SERVICE_URL=http://mock-service:8001

# App
FASTAPI_ENV=development
LOG_LEVEL=debug

# Frontend
VITE_API_BASE_URL=http://localhost:80
```

---

## Git Workflow

```
main       ← Production. Protected. Requires PR + 1 review.
develop    ← Staging. Protected. Requires PR + 1 review.
feature/*  ← e.g. feature/wajih/gateway-matching-engine
```

**Commit format:** `type(scope): description [migration: NNN]`
```bash
feat(mock): add jsonpath flavor matching [migration: 002]
fix(admin): correct JWT refresh expiry
chore(deps): update motor to 3.4
```

**PR checklist before merge:**
- [ ] Tests pass (`pytest` + `npm test`)
- [ ] Migration written if schema changed
- [ ] SCHEMA-VERSIONS.md updated
- [ ] No `.env` secrets committed
- [ ] Reviewed by 1 other developer

---

## Coding Standards

### Python / FastAPI
- Python 3.11+ type hints everywhere
- Pydantic v2 models for all request/response shapes
- `async def` for all route handlers and DB operations
- `motor` (async) for MongoDB reads/writes
- Never use `pymongo` directly in route handlers — only in migration scripts
- Error handling: raise `HTTPException` with meaningful status codes
- All routes grouped in `routers/` with `APIRouter(prefix=..., tags=[...])`

### TypeScript / React
- Strict TypeScript — no `any` types
- React Query for all server state (no Redux)
- Axios instance in `services/api.ts` with JWT interceptor
- `AuthContext` wraps the whole app for auth state
- Tailwind utility classes — no custom CSS unless unavoidable
- Shadcn/ui components preferred over custom components

### MongoDB
- Always use `ObjectId` for `_id` fields
- Timestamps: `created_at`, `updated_at` on all collections
- Indexes on frequently queried fields (see migration 001)
- Never query without a filter — always include at least `_id` or indexed field

---

## Do's & Don'ts

### ✅ Do
- Run `--dry-run` before any migration on non-dev environments
- Write both `migrate_up()` and `migrate_down()` for every migration
- Signal Mock Service to `/reload` after any gateway/endpoint/flavor change
- Keep `.env` out of git — use `.env.example` as the template
- Test locally with Docker before pushing

### ❌ Don't
- Don't push directly to `main` or `develop`
- Don't hardcode MongoDB connection strings in code — use env vars
- Don't add Redis (not in scope — MongoDB embedded docs handle the hot path)
- Don't modify `docker-compose.prod.yml` without Wajih's approval
- Don't run mongosh commands on production directly
- Don't skip the `/reload` call after admin writes — Mock Service will serve stale data

---

## Inter-Service Communication

```
Admin Service  →  POST /reload  →  Mock Service
```
After any create/update/delete on gateways, endpoints, or flavors:
```python
import httpx
async with httpx.AsyncClient() as client:
    await client.post(f"{settings.MOCK_SERVICE_URL}/reload")
```

---

## Common Patterns

### FastAPI Route with Auth
```python
from fastapi import APIRouter, Depends
from app.auth.dependencies import require_role
from app.models.gateway import GatewayCreate, GatewayResponse

router = APIRouter(prefix="/api/admin/gateways", tags=["gateways"])

@router.post("/", response_model=GatewayResponse)
async def create_gateway(
    data: GatewayCreate,
    user=Depends(require_role(["admin", "editor"])),
    db=Depends(get_db)
):
    ...
```

### MongoDB Async Query
```python
from motor.motor_asyncio import AsyncIOMotorClient

async def find_gateway(db, gateway_id: str):
    return await db.gateways.find_one({"_id": ObjectId(gateway_id)})
```

### Standard Error Response
```python
from fastapi import HTTPException

raise HTTPException(status_code=404, detail={
    "code": "GATEWAY_NOT_FOUND",
    "message": f"Gateway {gateway_id} does not exist"
})
```

---

## Where to Start (Mock Service — Sprint 1)

Start with **Mock Service** — smallest service, most critical core logic.

**Build order:**
1. `mock-service/app/config.py` — Settings from env vars
2. `mock-service/app/mongo.py` — Motor async client connection
3. `mock-service/app/models.py` — Pydantic models for Gateway/Endpoint/Flavor
4. `mock-service/app/engine.py` — **Core:** route matching + flavor selection logic
5. `mock-service/app/routes/health.py` — GET /health
6. `mock-service/app/main.py` — FastAPI app wiring
7. `mock-service/app/tests/test_engine.py` — Unit tests for engine.py
8. `mock-service/app/tests/test_matching.py` — Tests for flavor matching

**The engine.py is the heart of the whole system.** It must:
1. Accept: `method`, `path`, `headers`, `body`, `query_params`
2. Find matching gateway by `base_path`
3. Find matching endpoint by remaining `path` + `method`
4. Iterate flavors by `priority` (desc) — match headers (regex), body (jsonpath-ng), query
5. Return first matched flavor's response config
6. Fallback to `is_default=True` flavor if no match

---

*Last updated: 2026-05-07 | Owner: Wajih Aslam*
