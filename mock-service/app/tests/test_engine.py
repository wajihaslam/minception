"""
Unit tests for mock-service/app/engine.py

Run: cd mock-service && pytest app/tests/test_engine.py -v
"""
import pytest
from app import engine
from app.engine import match_request, load_configs


# ─── Sample gateway config (as stored in MongoDB) ────────────────────────────

SAMPLE_GATEWAYS = [
    {
        "_id": "gw1",
        "name": "Payments Gateway",
        "base_path": "/api/v1",
        "is_active": True,
        "endpoints": [
            {
                "_id": "ep1",
                "path": "/users/create",
                "method": "POST",
                "is_active": True,
                "flavors": [
                    {
                        "_id": "fl1",
                        "name": "Admin Success",
                        "priority": 10,
                        "is_default": False,
                        "is_active": True,
                        "match": {
                            "headers": {"Authorization": "Bearer admin_.*"},
                            "body": {"$.role": "admin"},
                            "query": {},
                        },
                        "response": {
                            "status": 200,
                            "headers": {"Content-Type": "application/json"},
                            "body": {"success": True, "role": "admin"},
                            "delay_ms": 0,
                        },
                    },
                    {
                        "_id": "fl2",
                        "name": "Validation Error",
                        "priority": 5,
                        "is_default": False,
                        "is_active": True,
                        "match": {
                            "headers": {},
                            "body": {"$.email": ""},
                            "query": {},
                        },
                        "response": {
                            "status": 400,
                            "body": {"error": "Email is required"},
                            "delay_ms": 0,
                        },
                    },
                    {
                        "_id": "fl3",
                        "name": "Default Success",
                        "priority": 0,
                        "is_default": True,
                        "is_active": True,
                        "match": {},
                        "response": {
                            "status": 200,
                            "body": {"success": True},
                            "delay_ms": 0,
                        },
                    },
                ],
            },
            {
                "_id": "ep2",
                "path": "/users/{id}",
                "method": "GET",
                "is_active": True,
                "flavors": [
                    {
                        "_id": "fl4",
                        "name": "Default",
                        "priority": 0,
                        "is_default": True,
                        "is_active": True,
                        "match": {},
                        "response": {"status": 200, "body": {"id": 1, "name": "Test User"}, "delay_ms": 0},
                    }
                ],
            },
        ],
    }
]


@pytest.fixture(autouse=True)
def setup_cache():
    """Load sample configs before each test."""
    load_configs(SAMPLE_GATEWAYS)
    yield
    load_configs([])


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestGatewayMatching:
    def test_matches_gateway_by_base_path(self):
        result = match_request("POST", "/api/v1/users/create", {}, {}, {})
        assert result.matched is True

    def test_no_match_for_unknown_gateway(self):
        result = match_request("POST", "/api/v2/unknown", {}, {}, {})
        assert result.matched is False
        assert result.response.status == 404

    def test_method_mismatch_falls_through(self):
        # DELETE has no endpoint in the sample config — no match
        result = match_request("DELETE", "/api/v1/users/create", {}, {}, {})
        assert result.matched is False


class TestFlavorMatching:
    def test_admin_flavor_matched_by_header_and_body(self):
        result = match_request(
            method="POST",
            path="/api/v1/users/create",
            headers={"Authorization": "Bearer admin_token"},
            body={"username": "wajih", "role": "admin"},
            query_params={},
        )
        assert result.matched is True
        assert result.flavor_name == "Admin Success"
        assert result.response.status == 200
        assert result.response.body["role"] == "admin"

    def test_validation_error_flavor_matched(self):
        result = match_request(
            method="POST",
            path="/api/v1/users/create",
            headers={},
            body={"email": ""},
            query_params={},
        )
        assert result.matched is True
        assert result.flavor_name == "Validation Error"
        assert result.response.status == 400

    def test_default_flavor_used_when_no_match(self):
        result = match_request(
            method="POST",
            path="/api/v1/users/create",
            headers={},
            body={"username": "someone"},
            query_params={},
        )
        assert result.matched is True
        assert result.flavor_name == "Default Success"
        assert result.response.status == 200

    def test_path_with_id_param_matches(self):
        result = match_request("GET", "/api/v1/users/123", {}, {}, {})
        assert result.matched is True
        assert result.response.status == 200


class TestInactiveGateway:
    def test_inactive_gateway_skipped(self):
        load_configs([{**SAMPLE_GATEWAYS[0], "is_active": False}])
        result = match_request("POST", "/api/v1/users/create", {}, {}, {})
        assert result.matched is False

    def test_inactive_endpoint_skipped(self):
        gw = {**SAMPLE_GATEWAYS[0]}
        gw["endpoints"] = [{**SAMPLE_GATEWAYS[0]["endpoints"][0], "is_active": False}]
        load_configs([gw])
        result = match_request("POST", "/api/v1/users/create", {}, {}, {})
        assert result.matched is False
