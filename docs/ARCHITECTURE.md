# Architecture — Minception

## Overview

Microservices v3: 3 independent services behind nginx, sharing one MongoDB Atlas cluster.

## Services

| Service | Port | Tech | Role |
|---------|------|------|------|
| Mock Service | 8001 | FastAPI + Python | Intercepts HTTP, matches flavors, returns responses |
| Admin Service | 8002 | FastAPI + Python | CRUD, JWT auth, dashboard, user management |
| Frontend | 3000 | React + TypeScript | Admin dashboard UI |
| nginx | 80/443 | nginx 1.24 | Reverse proxy, routing |

## Data Model (MongoDB)

Embedded document hierarchy — one query returns everything needed for mock matching:

```
gateways (collection)
  └── base_path: "/api/v1"
      endpoints[] (embedded)
        └── path: "/users/create", method: "POST"
            flavors[] (embedded)
              └── match rules + response config
```

## Inter-Service Communication

Admin Service calls `POST mock-service:8001/reload` after any config write.
Mock Service reloads its in-memory cache from MongoDB.
No message queue, no Redis — simple HTTP call on same Docker network.

## Request Flow (Mock)

```
Client → nginx:80 → mock-service:8001
  1. Load gateway configs from memory cache
  2. Match base_path → gateway
  3. Match path + method → endpoint
  4. Iterate flavors by priority (desc)
  5. Match headers (regex) + body (jsonpath) + query
  6. Return matched flavor response
  7. Log to MongoDB (fire-and-forget)
```

## Deployment Environments

| Env | MongoDB | Docker | Trigger |
|-----|---------|--------|---------|
| Local | Container | docker-compose.local.yml | Manual |
| Staging | Atlas | docker-compose.staging.yml | Push to develop |
| Production | Atlas | docker-compose.prod.yml | Manual approval |
