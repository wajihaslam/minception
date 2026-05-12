# Admin Service

FastAPI service that handles authentication, CRUD operations, and the admin dashboard for Minception.

---

## Error Logs Feature

Both `admin-service` and `mock-service` persist WARNING+ log records to a shared `error_logs` MongoDB collection. The admin UI exposes these at `/error-logs` (admin role only).

### How it works

1. `DBLogHandler` (in `app/logging_handler.py`) is attached to the root Python logger at startup.
2. Every `logger.warning(...)` / `logger.error(...)` / `logger.critical(...)` call is enqueued and written to MongoDB asynchronously via a background daemon thread using `pymongo` (sync driver).
3. `RequestContextMiddleware` sets per-request `contextvars` (request_id, user_id, endpoint, method, status). `RequestContextFilter` reads these and injects them into every `LogRecord` before it reaches the handler.
4. Secrets are redacted before persistence: Bearer tokens, password fields, token fields, API keys.
5. mock-service writes to the same collection via `ADMIN_DB_URL` (same MongoDB instance).

### Retention

Handled by a MongoDB TTL index on the `timestamp` field — identical to the `request_logs` pattern. Default: 90 days. To change:

1. Set `ERROR_LOG_RETENTION_DAYS=<days>` in your environment.
2. Run `python -m migrations.runner --env dev` to apply `002_error_logs`.

> **Changing retention after initial setup**: the TTL value is baked into the index at creation time. To update it, connect via `mongosh` and run:
> ```js
> db.error_logs.dropIndex("timestamp_1")
> db.error_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: <new_seconds> })
> ```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ERROR_LOG_MIN_LEVEL` | `WARNING` | Minimum log level to persist. One of `WARNING`, `ERROR`, `CRITICAL`. |
| `ERROR_LOG_RETENTION_DAYS` | `90` | Days before TTL index auto-deletes logs. Read at migration time. |
| `ADMIN_DB_URL` *(mock-service only)* | `mongodb://localhost:27017/api_gateway_dev` | Connection string mock-service uses to write to the shared admin DB. |

### Running the migration

```bash
# Apply (creates error_logs collection + indexes)
python -m migrations.runner --env dev

# Dry run
python -m migrations.runner --env dev --dry-run

# Rollback (drops the collection — destructive)
# Edit runner.py to call migrate_down, or run manually via mongosh
```

### API

```
GET /api/admin/error-logs/
  Query params:
    search        string          regex search on message (case-insensitive)
    levels        string[]        ERROR | WARNING | CRITICAL
    error_types   string[]        exception class names
    services      string[]        admin-service | mock-service
    request_id    string          exact match on request_id
    start_date    ISO date        default: today - 5 days
    end_date      ISO date        default: today
    page          int (≥1)        default: 1
    page_size     int (1-100)     default: 25
    sort_by       string          timestamp | level | service | error_type
    sort_order    asc | desc      default: desc
  Auth: admin role only

GET /api/admin/error-logs/{id}
  Auth: admin role only
```

Max date range: 90 days. Returns 400 `DATE_RANGE_TOO_LARGE` if exceeded.
