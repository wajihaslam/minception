# Minception — AI Agent Context (Codex / OpenAI Agents / Gemini CLI)

> This file provides context for AI coding agents (GitHub Copilot, OpenAI Codex, Gemini CLI, Aider, etc.)
> For Claude Code, see CLAUDE.md. For Cursor, see .cursorrules.

---

## Project Summary

**Minception** is an API Mock Gateway platform.
It lets teams configure mock HTTP endpoints with conditional responses (called "flavors") so frontend and test teams can develop without real backends.

**Repo:** `bitbucket.org/minception/minception` (monorepo)

---

## Architecture

```
nginx (port 80)
├── /mock/* → mock-service:8001   (Python/FastAPI — stateless, read-only)
├── /api/*  → admin-service:8002  (Python/FastAPI — CRUD, JWT auth)
└── /*      → frontend:3000       (React/TypeScript — admin dashboard)
                     ↕
              MongoDB Atlas
       (gateways → endpoints → flavors)
```

---

## Service Responsibilities

### mock-service (port 8001)
- Catches all incoming mock HTTP requests
- Finds matching gateway/endpoint/flavor in MongoDB (1 query)
- Returns configured mock response (status, headers, body, delay)
- Exposes `POST /reload` — Admin service calls this after any config change

### admin-service (port 8002)
- JWT auth (login/refresh/me)
- Full CRUD for gateways, endpoints, flavors, users
- Dashboard stats aggregations
- Request log search/filter
- Calls `mock-service/reload` after any write

### frontend (port 3000)
- React SPA admin dashboard
- Talks only to admin-service via `/api/*`
- Pages: Login, Dashboard, Gateways, EndpointEditor, Logs, Users

---

## MongoDB Schema (Embedded Documents)

```javascript
// gateways collection
{
  _id: ObjectId,
  name: String,
  base_path: String,          // "/api/v1"
  description: String,
  is_active: Boolean,
  created_at: Date,
  updated_at: Date,
  endpoints: [{
    _id: ObjectId,
    path: String,             // "/users/create"
    method: String,           // GET|POST|PUT|DELETE|PATCH
    description: String,
    is_active: Boolean,
    flavors: [{
      _id: ObjectId,
      name: String,
      priority: Number,       // higher = evaluated first
      is_default: Boolean,    // fallback if no match
      match: {
        headers: Object,      // { "Authorization": "Bearer admin_.*" } — regex
        body: Object,         // { "$.role": "admin" } — jsonpath
        query: Object         // { "page": "1" } — exact/regex
      },
      response: {
        status: Number,
        headers: Object,
        body: Object,
        delay_ms: Number
      }
    }]
  }]
}

// users collection
{ _id, username, email, password_hash, role, is_active, created_at }
// role: "admin" | "editor" | "viewer"

// request_logs collection
{ _id, gateway_id, endpoint_path, method, matched_flavor, request, response, client_ip, timestamp }
```

---

## Python Conventions

```python
# All route handlers are async
@router.get("/gateways", response_model=list[GatewayResponse])
async def list_gateways(user=Depends(require_role(["admin", "editor", "viewer"])), db=Depends(get_db)):
    gateways = await db.gateways.find({"is_active": True}).to_list(None)
    return {"success": True, "data": gateways, "error": None}

# Standard error
raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Gateway not found"})

# Motor (async MongoDB)
doc = await db.gateways.find_one({"_id": ObjectId(gateway_id)})
await db.gateways.insert_one(document)
await db.gateways.update_one({"_id": ObjectId(id)}, {"$set": update_data})
await db.gateways.delete_one({"_id": ObjectId(id)})
```

---

## TypeScript Conventions

```typescript
// All API calls through the axios instance in src/services/api.ts
import api from '@/services/api';
const { data } = await api.get<ApiResponse<Gateway[]>>('/api/admin/gateways');

// React Query
const { data, isLoading } = useQuery({
  queryKey: ['gateways'],
  queryFn: () => api.get('/api/admin/gateways').then(r => r.data.data)
});

// Auth check
const { user } = useAuth(); // from AuthContext
if (!user) return <Navigate to="/login" />;
```

---

## Standard API Response
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `mock-service/app/engine.py` | Core matching logic — most critical file |
| `mock-service/app/mongo.py` | Async MongoDB connection |
| `admin-service/app/auth/dependencies.py` | `require_role()` FastAPI dep |
| `admin-service/app/routes/gateways.py` | Gateway CRUD |
| `migrations/runner.py` | Migration orchestrator |
| `migrations/versions/001_initial_schema.py` | Initial collections + indexes |
| `docker-compose.local.yml` | Local dev environment |
| `SCHEMA-VERSIONS.md` | Track all schema changes |

---

## Running Locally

```bash
# Start all services
docker compose -f docker-compose.local.yml up --build

# URLs
# Mock Service docs:  http://localhost:8001/docs
# Admin Service docs: http://localhost:8002/docs
# Frontend:           http://localhost:3000

# Run migrations
python -m migrations.runner --env dev

# Run tests
cd mock-service && pytest app/tests/ -v
cd admin-service && pytest app/tests/ -v
cd frontend && npm test
```

---

## Rules for AI Agents

1. **Always async** — all Python DB calls and FastAPI handlers use `async def`
2. **Pydantic v2** for all models — no raw dict returns from routes
3. **motor only** for MongoDB in services (not pymongo)
4. **No Redis** — not in scope for this project
5. **Signal `/reload`** — after any admin write, call `POST mock-service/reload`
6. **Embedded documents** — do not normalize gateways/endpoints/flavors into separate collections
7. **Strict TypeScript** — no `any` types in frontend code
8. **Git Flow** — feature branches from `develop`, never commit to `main`
9. **Migration files** are sequential: `001_`, `002_`, `003_` — always write both `migrate_up()` and `migrate_down()`
10. **No secrets in code** — all config via environment variables

---

## Roles & Permissions

| Action | admin | editor | viewer |
|--------|-------|--------|--------|
| View gateways/endpoints/logs | ✅ | ✅ | ✅ |
| Create/edit gateways | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Delete gateways | ✅ | ❌ | ❌ |

---

*Owner: Wajih Aslam | Last updated: 2026-05-15*
