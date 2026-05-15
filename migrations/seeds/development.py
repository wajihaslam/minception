"""
development.py — Fresh sample data seed for Minception (dev environment).

Usage:
    python -m migrations.seeds.development

Clears all gateways and request_logs, then inserts:
  - 1 Gateway  : Simpaisa Payment API  (/api/v1)
  - 4 Endpoints: POST /auth/login
                 POST /payments/initiate
                 GET  /payments/{payment_id}
                 POST /payments/{payment_id}/refund
  Each endpoint gets 4 standard flavors:
    1. Success (default)
    2. Validation Error  — 422, matched on header X-Scenario: validation_error
    3. Unauthorized      — 401, matched on header X-Scenario: unauthorized
    4. Server Error      — 500, matched on header X-Scenario: server_error
"""

import asyncio
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import os


MONGO_URL = os.getenv("MONGO_DEV_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB_NAME", "api_gateway_dev")


def _oid() -> ObjectId:
    return ObjectId()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def std_flavors(success_body: dict, resource_name: str = "resource") -> list[dict]:
    """Return 4 standard flavors for any endpoint."""
    return [
        {
            "_id": _oid(),
            "name": "Success",
            "priority": 0,
            "is_default": True,
            "is_active": True,
            "match": {"headers": {}, "body": {}, "query": {}},
            "response": {
                "status": 200,
                "headers": {"Content-Type": "application/json"},
                "body": success_body,
                "delay_ms": 0,
            },
        },
        {
            "_id": _oid(),
            "name": "Validation Error",
            "priority": 10,
            "is_default": False,
            "is_active": True,
            "match": {
                "headers": {"X-Scenario": "validation_error"},
                "body": {},
                "query": {},
            },
            "response": {
                "status": 422,
                "headers": {"Content-Type": "application/json"},
                "body": {
                    "success": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid {resource_name} data provided",
                        "details": [{"field": "body", "issue": "Required field missing"}],
                    },
                },
                "delay_ms": 0,
            },
        },
        {
            "_id": _oid(),
            "name": "Unauthorized",
            "priority": 20,
            "is_default": False,
            "is_active": True,
            "match": {
                "headers": {"X-Scenario": "unauthorized"},
                "body": {},
                "query": {},
            },
            "response": {
                "status": 401,
                "headers": {"Content-Type": "application/json"},
                "body": {
                    "success": False,
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Authentication required. Invalid or expired token.",
                    },
                },
                "delay_ms": 0,
            },
        },
        {
            "_id": _oid(),
            "name": "Server Error",
            "priority": 30,
            "is_default": False,
            "is_active": True,
            "match": {
                "headers": {"X-Scenario": "server_error"},
                "body": {},
                "query": {},
            },
            "response": {
                "status": 500,
                "headers": {"Content-Type": "application/json"},
                "body": {
                    "success": False,
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred. Please try again later.",
                    },
                },
                "delay_ms": 0,
            },
        },
    ]


GATEWAY = {
    "_id": _oid(),
    "name": "Simpaisa Payment API",
    "base_path": "/api/v1",
    "description": "Mock gateway for Simpaisa payment flows — auth, initiate, status, refund",
    "is_active": True,
    "created_at": _now(),
    "updated_at": _now(),
    "endpoints": [
        # ── 1. POST /auth/login ───────────────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/auth/login",
            "method": "POST",
            "description": "Authenticate a user and return JWT access + refresh tokens",
            "is_active": True,
            "flavors": std_flavors(
                success_body={
                    "success": True,
                    "data": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_access",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_refresh",
                        "token_type": "Bearer",
                        "expires_in": 3600,
                        "user": {
                            "id": "usr_01HXMOCK",
                            "email": "user@simpaisa.com",
                            "role": "customer",
                        },
                    },
                    "error": None,
                },
                resource_name="credentials",
            ),
        },

        # ── 2. POST /payments/initiate ────────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/payments/initiate",
            "method": "POST",
            "description": "Initiate a new payment transaction",
            "is_active": True,
            "flavors": std_flavors(
                success_body={
                    "success": True,
                    "data": {
                        "payment_id": "pay_01HXMOCKPAYMENT",
                        "status": "PENDING",
                        "amount": 1000,
                        "currency": "PKR",
                        "created_at": "2026-05-14T10:00:00Z",
                        "redirect_url": "https://pay.simpaisa.com/checkout/pay_01HXMOCKPAYMENT",
                    },
                    "error": None,
                },
                resource_name="payment",
            ),
        },

        # ── 3. GET /payments/{payment_id} ─────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/payments/{payment_id}",
            "method": "GET",
            "description": "Fetch the status and details of a payment by ID",
            "is_active": True,
            "flavors": std_flavors(
                success_body={
                    "success": True,
                    "data": {
                        "payment_id": "pay_01HXMOCKPAYMENT",
                        "status": "COMPLETED",
                        "amount": 1000,
                        "currency": "PKR",
                        "payer": {"name": "Test User", "phone": "+923001234567"},
                        "merchant": {"id": "mer_01HXMOCK", "name": "Test Merchant"},
                        "created_at": "2026-05-14T10:00:00Z",
                        "completed_at": "2026-05-14T10:01:12Z",
                    },
                    "error": None,
                },
                resource_name="payment",
            ),
        },

        # ── 4. POST /payments/{payment_id}/refund ─────────────────────────────
        {
            "_id": _oid(),
            "path": "/payments/{payment_id}/refund",
            "method": "POST",
            "description": "Request a full or partial refund for a completed payment",
            "is_active": True,
            "flavors": std_flavors(
                success_body={
                    "success": True,
                    "data": {
                        "refund_id": "ref_01HXMOCKREFUND",
                        "payment_id": "pay_01HXMOCKPAYMENT",
                        "status": "REFUND_INITIATED",
                        "amount": 1000,
                        "currency": "PKR",
                        "reason": "Customer requested refund",
                        "initiated_at": "2026-05-14T11:00:00Z",
                    },
                    "error": None,
                },
                resource_name="refund",
            ),
        },
    ],
}


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connecting to: {DB_NAME}")

    # ── Wipe existing data ────────────────────────────────────────────────────
    deleted_gw  = await db.gateways.delete_many({})
    deleted_log = await db.request_logs.delete_many({})
    print(f"Cleared {deleted_gw.deleted_count} gateway(s) and {deleted_log.deleted_count} request log(s)")

    # ── Insert fresh gateway ──────────────────────────────────────────────────
    await db.gateways.insert_one(GATEWAY)
    ep_count = len(GATEWAY["endpoints"])
    fl_count = sum(len(ep["flavors"]) for ep in GATEWAY["endpoints"])
    print(f"Inserted gateway '{GATEWAY['name']}' ({ep_count} endpoints, {fl_count} flavors)")
    for ep in GATEWAY["endpoints"]:
        fl_names = ", ".join(f["name"] for f in ep["flavors"])
        print(f"  {ep['method']:6s} {ep['path']:40s} -> [{fl_names}]")

    client.close()
    print("\nDone. Reload the mock service if it is running.")


if __name__ == "__main__":
    asyncio.run(seed())
