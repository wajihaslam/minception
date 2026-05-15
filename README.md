# 🌀 Minception

> API Mock Gateway platform — configure realistic mock HTTP endpoints with conditional responses.

Built for internal development and testing workflows.

---

## What Is It?

Minception lets teams define mock API endpoints with multiple response "flavors" — conditional responses based on request headers, body, or query params. Frontend teams and QA can develop against realistic APIs without depending on real backends.

```
POST /mock/api/v1/users/create
  Authorization: Bearer admin_token   →  200 { "success": true, "role": "admin" }
  (no auth header)                    →  200 { "success": true }
  X-Force-Error: 500                  →  500 { "error": "Internal Server Error" }
```

---

## Architecture

```
nginx (port 80)
 ├── /mock/*   → Mock Service  (FastAPI :8001) — matches requests, returns responses
 ├── /api/*    → Admin Service (FastAPI :8002) — CRUD, JWT auth, dashboard
 └── /*        → Frontend      (React   :3000) — admin dashboard UI
                         ↕
               MongoDB Atlas (gateways → endpoints → flavors)
```

---

## Quick Start

```bash
# 1. Clone
git clone https://bitbucket.org/minception/minception.git
cd minception

# 2. Setup
cp .env.example .env
# Fill in MONGO_DEV_URL (ask Wajih for credentials)

# 3. Run
./scripts/setup-dev.sh
```

Then open:
- **Dashboard:** http://localhost:3000 (login: `admin` / `changeme123`)
- **Mock API docs:** http://localhost:8001/docs
- **Admin API docs:** http://localhost:8002/docs

---

## Team

| Developer | Bitbucket | Role |
|-----------|----------|------|
| Wajih Aslam | @wajih | Lead / Arch |
| Dev 2 | @dev2 | Backend |
| Dev 3 | @dev3 | Frontend |

---

## Branch Strategy

```
main      ← Production (protected, manual deploy)
develop   ← Staging (protected, auto-deploy)
feature/* ← Your work (branch from develop)
```

Commit format: `type(scope): description [migration: NNN]`

---

## AI Agent Context Files

| Tool | File |
|------|------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| Codex / Copilot / Aider | `AGENTS.md` |

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Migrations Guide](docs/MIGRATIONS.md)
- [Team Workflow](docs/TEAM-WORKFLOW.md)
- [Schema Versions](SCHEMA-VERSIONS.md)

---

## License

Private — Internal use only.
