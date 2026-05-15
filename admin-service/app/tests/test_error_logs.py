"""
Tests for GET /api/admin/error-logs endpoints.

Uses pytest-asyncio + FastAPI TestClient with a mocked DB dependency.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient


def _make_log_doc(overrides: dict | None = None) -> dict:
    from bson import ObjectId

    doc = {
        "_id": ObjectId(),
        "timestamp": datetime.now(timezone.utc),
        "service": "admin-service",
        "level": "ERROR",
        "error_type": "ValueError",
        "message": "Something went wrong",
        "stack_trace": None,
        "logger_name": "app.routes.gateways",
        "module": "gateways",
        "function": "create_gateway",
        "line_no": 42,
        "request_id": "abc123",
        "user_id": "admin",
        "endpoint": "/api/admin/gateways",
        "http_method": "POST",
        "http_status": 500,
        "extra": None,
    }
    if overrides:
        doc.update(overrides)
    return doc


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def client_as_admin():
    """TestClient with DB and auth dependencies overridden for an admin user."""
    from unittest.mock import patch as _patch
    from app.main import app
    from app.mongo import get_db
    from app.auth.dependencies import get_current_user

    mock_db = MagicMock()
    # Lifespan calls db.users.find_one — must be awaitable
    mock_db.users.find_one = AsyncMock(return_value={"username": "admin", "role": "admin"})

    # Motor: aggregate() is sync (returns cursor), to_list() is async
    facet_result = {
        "logs": [_make_log_doc()],
        "total": [{"count": 1}],
        "error_type_facets": [{"_id": "ValueError", "count": 1}],
        "service_facets": [{"_id": "admin-service", "count": 1}],
        "level_facets": [{"_id": "ERROR", "count": 1}],
    }
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[facet_result])
    mock_db.error_logs.aggregate = MagicMock(return_value=mock_cursor)
    mock_db.error_logs.find_one = AsyncMock(return_value=_make_log_doc())

    def override_db():
        return mock_db

    def override_admin():
        return {"username": "admin", "role": "admin"}

    app.dependency_overrides[get_db] = override_db
    # Override get_current_user so require_role's inner closure gets the mock user
    app.dependency_overrides[get_current_user] = override_admin

    # Patch the direct get_db() call inside lifespan/_ensure_admin_user
    with _patch("app.main.get_db", return_value=mock_db):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


@pytest.fixture
def client_as_viewer():
    """TestClient overridden as viewer — should get 403 on admin-only routes."""
    from unittest.mock import patch as _patch
    from app.main import app
    from app.auth.dependencies import get_current_user

    mock_db = MagicMock()
    mock_db.users.find_one = AsyncMock(return_value={"username": "admin", "role": "admin"})

    def override_viewer():
        return {"username": "viewer", "role": "viewer"}

    app.dependency_overrides[get_current_user] = override_viewer

    with _patch("app.main.get_db", return_value=mock_db):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

    app.dependency_overrides.clear()


# ── Tests ──────────────────────────────────────────────────────────────────

class TestListErrorLogs:
    def test_returns_200_for_admin(self, client_as_admin):
        resp = client_as_admin.get("/api/admin/error-logs/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "logs" in body["data"]
        assert "pagination" in body["data"]
        assert "facets" in body["data"]

    def test_returns_403_for_viewer(self, client_as_viewer):
        resp = client_as_viewer.get("/api/admin/error-logs/")
        assert resp.status_code == 403

    def test_default_date_range_is_5_days(self, client_as_admin):
        """No start_date/end_date → API uses 5-day default without error."""
        resp = client_as_admin.get("/api/admin/error-logs/")
        assert resp.status_code == 200

    def test_date_range_over_90_days_returns_400(self, client_as_admin):
        start = (datetime.now(timezone.utc) - timedelta(days=91)).date().isoformat()
        end = datetime.now(timezone.utc).date().isoformat()
        resp = client_as_admin.get(
            f"/api/admin/error-logs/?start_date={start}&end_date={end}"
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "DATE_RANGE_TOO_LARGE"

    def test_pagination_params_forwarded(self, client_as_admin):
        resp = client_as_admin.get("/api/admin/error-logs/?page=2&page_size=10")
        assert resp.status_code == 200
        pagination = resp.json()["data"]["pagination"]
        assert pagination["page"] == 2
        assert pagination["page_size"] == 10

    def test_facets_present_in_response(self, client_as_admin):
        resp = client_as_admin.get("/api/admin/error-logs/")
        facets = resp.json()["data"]["facets"]
        assert "error_types" in facets
        assert "services" in facets
        assert "levels" in facets


class TestGetErrorLog:
    def test_returns_single_log_for_admin(self, client_as_admin):
        from bson import ObjectId

        oid = str(ObjectId())
        resp = client_as_admin.get(f"/api/admin/error-logs/{oid}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_invalid_id_returns_404(self, client_as_admin):
        resp = client_as_admin.get("/api/admin/error-logs/not-a-valid-id")
        assert resp.status_code == 404
