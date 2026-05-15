"""
development.py — Fresh sample data seed for Minception (dev environment).

Usage:
    python -m migrations.seeds.development

Clears all gateways and request_logs, then inserts:
  - 1 Gateway  : Split-the-Bill  (/api)
  - 4 Endpoints:
      POST /bills               — Create bill, split amount, generate payment links
      GET  /bills/{id}          — Fetch bill + all participant payment statuses
      GET  /payments/{link_id}  — Get payment link details (for redirect / QR)
      GET  /bills/{id}/summary  — Aggregated view: total paid, pending, collected

  Each endpoint gets 6 flavors matched via X-Scenario header:
    (no header)                   → Success (default)
    X-Scenario: validation_error  → 422 Validation Error
    X-Scenario: unauthorized      → 401 Unauthorized
    X-Scenario: not_found         → 404 Not Found
    X-Scenario: conflict          → 409 Conflict / Already Paid / Expired
    X-Scenario: server_error      → 500 Internal Server Error
"""

import asyncio
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import os


MONGO_URL = os.getenv("MONGO_DEV_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB_NAME", "api_gateway_dev")

PLATFORM_FEE_PKR = 5.50


def _oid() -> ObjectId:
    return ObjectId()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _flavors(
    success_body: dict,
    validation_body: dict,
    not_found_body: dict,
    conflict_body: dict,
    success_status: int = 200,
) -> list[dict]:
    """
    Return 6 standard flavors for a Split-the-Bill endpoint.
    Priority order (highest wins): conflict(50) > not_found(40) > unauthorized(30)
                                   > validation(20) > success(0, default)
    Server error sits at priority 10 as a low-priority catch-all override.
    """
    return [
        # ── 1. Success (default) ─────────────────────────────────────────────
        {
            "_id": _oid(),
            "name": "Success",
            "priority": 0,
            "is_default": True,
            "is_active": True,
            "match": {"headers": {}, "body": {}, "query": {}},
            "response": {
                "status": success_status,
                "headers": {"Content-Type": "application/json"},
                "body": success_body,
                "delay_ms": 0,
            },
        },
        # ── 2. Validation Error ──────────────────────────────────────────────
        {
            "_id": _oid(),
            "name": "Validation Error",
            "priority": 20,
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
                "body": validation_body,
                "delay_ms": 0,
            },
        },
        # ── 3. Unauthorized ──────────────────────────────────────────────────
        {
            "_id": _oid(),
            "name": "Unauthorized",
            "priority": 30,
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
                    "data": None,
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Authentication required. Provide a valid Bearer token.",
                    },
                },
                "delay_ms": 0,
            },
        },
        # ── 4. Not Found ─────────────────────────────────────────────────────
        {
            "_id": _oid(),
            "name": "Not Found",
            "priority": 40,
            "is_default": False,
            "is_active": True,
            "match": {
                "headers": {"X-Scenario": "not_found"},
                "body": {},
                "query": {},
            },
            "response": {
                "status": 404,
                "headers": {"Content-Type": "application/json"},
                "body": not_found_body,
                "delay_ms": 0,
            },
        },
        # ── 5. Conflict / Already Paid / Expired ─────────────────────────────
        {
            "_id": _oid(),
            "name": "Conflict",
            "priority": 50,
            "is_default": False,
            "is_active": True,
            "match": {
                "headers": {"X-Scenario": "conflict"},
                "body": {},
                "query": {},
            },
            "response": {
                "status": 409,
                "headers": {"Content-Type": "application/json"},
                "body": conflict_body,
                "delay_ms": 0,
            },
        },
        # ── 6. Server Error ──────────────────────────────────────────────────
        {
            "_id": _oid(),
            "name": "Server Error",
            "priority": 10,
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
                    "data": None,
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred. Please try again later.",
                    },
                },
                "delay_ms": 0,
            },
        },
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Gateway document
# ─────────────────────────────────────────────────────────────────────────────

GATEWAY = {
    "_id": _oid(),
    "name": "Split-the-Bill",
    "base_path": "/api",
    "description": (
        "Mock gateway for a bill-splitting app. "
        "Users enter a total PKR amount and headcount; "
        "the API calculates each person's share plus a PKR 5.50 platform fee "
        "and returns unique payment links for every participant."
    ),
    "is_active": True,
    "created_at": _now(),
    "updated_at": _now(),
    "endpoints": [

        # ── 1. POST /bills ────────────────────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/bills",
            "method": "POST",
            "description": (
                "Create a new bill. Accepts total amount (PKR) and participant count, "
                "calculates per-person share + PKR 5.50 platform fee, "
                "and returns unique payment links for each participant."
            ),
            "is_active": True,
            "flavors": _flavors(
                success_status=201,
                success_body={
                    "success": True,
                    "data": {
                        "bill_id": "bill_01MOCK",
                        "title": "Dinner at Cosa Nostra",
                        "total_amount": 4500.00,
                        "platform_fee_per_person": PLATFORM_FEE_PKR,
                        "participant_count": 4,
                        "per_person_share": 1125.00,
                        "per_person_total": 1130.50,
                        "currency": "PKR",
                        "status": "pending",
                        "created_at": "2026-05-15T18:00:00Z",
                        "expires_at": "2026-05-16T18:00:00Z",
                        "participants": [
                            {
                                "link_id": "lnk_01MOCK",
                                "label": "Person 1",
                                "amount_due": 1130.50,
                                "payment_url": "http://localhost:80/mock/api/payments/lnk_01MOCK",
                                "status": "pending",
                            },
                            {
                                "link_id": "lnk_02MOCK",
                                "label": "Person 2",
                                "amount_due": 1130.50,
                                "payment_url": "http://localhost:80/mock/api/payments/lnk_02MOCK",
                                "status": "pending",
                            },
                            {
                                "link_id": "lnk_03MOCK",
                                "label": "Person 3",
                                "amount_due": 1130.50,
                                "payment_url": "http://localhost:80/mock/api/payments/lnk_03MOCK",
                                "status": "pending",
                            },
                            {
                                "link_id": "lnk_04MOCK",
                                "label": "Person 4",
                                "amount_due": 1130.50,
                                "payment_url": "http://localhost:80/mock/api/payments/lnk_04MOCK",
                                "status": "pending",
                            },
                        ],
                    },
                    "error": None,
                },
                validation_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Request body is invalid.",
                        "details": [
                            {"field": "total_amount", "issue": "Must be a positive number greater than 0"},
                            {"field": "participant_count", "issue": "Must be an integer between 2 and 50"},
                        ],
                    },
                },
                not_found_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Referenced resource not found.",
                    },
                },
                conflict_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "DUPLICATE_BILL",
                        "message": "An identical bill was submitted within the last 60 seconds. Please wait before retrying.",
                    },
                },
            ),
        },

        # ── 2. GET /bills/{id} ────────────────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/bills/{id}",
            "method": "GET",
            "description": (
                "Fetch a bill by ID. Returns the bill metadata and the payment "
                "status of every participant (paid / pending / expired)."
            ),
            "is_active": True,
            "flavors": _flavors(
                success_body={
                    "success": True,
                    "data": {
                        "bill_id": "bill_01MOCK",
                        "title": "Dinner at Cosa Nostra",
                        "total_amount": 4500.00,
                        "platform_fee_per_person": PLATFORM_FEE_PKR,
                        "participant_count": 4,
                        "per_person_share": 1125.00,
                        "per_person_total": 1130.50,
                        "currency": "PKR",
                        "status": "partial",
                        "created_at": "2026-05-15T18:00:00Z",
                        "expires_at": "2026-05-16T18:00:00Z",
                        "participants": [
                            {
                                "link_id": "lnk_01MOCK",
                                "label": "Person 1",
                                "amount_due": 1130.50,
                                "status": "paid",
                                "paid_at": "2026-05-15T18:12:30Z",
                            },
                            {
                                "link_id": "lnk_02MOCK",
                                "label": "Person 2",
                                "amount_due": 1130.50,
                                "status": "paid",
                                "paid_at": "2026-05-15T18:15:44Z",
                            },
                            {
                                "link_id": "lnk_03MOCK",
                                "label": "Person 3",
                                "amount_due": 1130.50,
                                "status": "pending",
                                "paid_at": None,
                            },
                            {
                                "link_id": "lnk_04MOCK",
                                "label": "Person 4",
                                "amount_due": 1130.50,
                                "status": "pending",
                                "paid_at": None,
                            },
                        ],
                    },
                    "error": None,
                },
                validation_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Bill ID format is invalid. Expected a 12-character alphanumeric string.",
                    },
                },
                not_found_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "BILL_NOT_FOUND",
                        "message": "No bill found with the given ID.",
                    },
                },
                conflict_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "BILL_EXPIRED",
                        "message": "This bill has expired and is no longer accessible.",
                        "expired_at": "2026-05-16T18:00:00Z",
                    },
                },
            ),
        },

        # ── 3. GET /payments/{link_id} ────────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/payments/{link_id}",
            "method": "GET",
            "description": (
                "Fetch payment link details by link ID. Used by the payment redirect / QR "
                "page to show the participant their share amount and payment status."
            ),
            "is_active": True,
            "flavors": _flavors(
                success_body={
                    "success": True,
                    "data": {
                        "link_id": "lnk_03MOCK",
                        "bill_id": "bill_01MOCK",
                        "bill_title": "Dinner at Cosa Nostra",
                        "label": "Person 3",
                        "amount_due": 1130.50,
                        "breakdown": {
                            "share": 1125.00,
                            "platform_fee": PLATFORM_FEE_PKR,
                        },
                        "currency": "PKR",
                        "status": "pending",
                        "expires_at": "2026-05-16T18:00:00Z",
                        "qr_code_url": "http://localhost:80/mock/api/payments/lnk_03MOCK/qr",
                    },
                    "error": None,
                },
                validation_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Payment link ID format is invalid.",
                    },
                },
                not_found_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "LINK_NOT_FOUND",
                        "message": "No payment link found with the given ID.",
                    },
                },
                conflict_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "ALREADY_PAID",
                        "message": "This payment link has already been settled.",
                        "paid_at": "2026-05-15T18:12:30Z",
                        "amount_paid": 1130.50,
                    },
                },
            ),
        },

        # ── 4. GET /bills/{id}/summary ────────────────────────────────────────
        {
            "_id": _oid(),
            "path": "/bills/{id}/summary",
            "method": "GET",
            "description": (
                "Aggregated summary view for a bill. Returns total collected, "
                "pending amount, paid/pending participant counts, and collection percentage."
            ),
            "is_active": True,
            "flavors": _flavors(
                success_body={
                    "success": True,
                    "data": {
                        "bill_id": "bill_01MOCK",
                        "title": "Dinner at Cosa Nostra",
                        "currency": "PKR",
                        "status": "partial",
                        "participant_count": 4,
                        "paid_count": 2,
                        "pending_count": 2,
                        "total_bill_amount": 4500.00,
                        "total_with_fees": 4522.00,
                        "amount_collected": 2261.00,
                        "amount_pending": 2261.00,
                        "platform_fees_collected": 11.00,
                        "collection_percentage": 50.0,
                        "created_at": "2026-05-15T18:00:00Z",
                        "expires_at": "2026-05-16T18:00:00Z",
                        "last_payment_at": "2026-05-15T18:15:44Z",
                    },
                    "error": None,
                },
                validation_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Bill ID format is invalid. Expected a 12-character alphanumeric string.",
                    },
                },
                not_found_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "BILL_NOT_FOUND",
                        "message": "No bill found with the given ID.",
                    },
                },
                conflict_body={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "BILL_EXPIRED",
                        "message": "This bill has expired. Summary data is read-only after expiry.",
                        "expired_at": "2026-05-16T18:00:00Z",
                    },
                },
            ),
        },
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connecting to: {DB_NAME}")

    deleted_gw  = await db.gateways.delete_many({})
    deleted_log = await db.request_logs.delete_many({})
    print(f"Cleared {deleted_gw.deleted_count} gateway(s) and {deleted_log.deleted_count} request log(s)")

    await db.gateways.insert_one(GATEWAY)
    ep_count = len(GATEWAY["endpoints"])
    fl_count = sum(len(ep["flavors"]) for ep in GATEWAY["endpoints"])
    print(f"Inserted gateway '{GATEWAY['name']}' ({ep_count} endpoints, {fl_count} flavors)")
    for ep in GATEWAY["endpoints"]:
        fl_names = ", ".join(f["name"] for f in ep["flavors"])
        print(f"  {ep['method']:6s} {ep['path']:40s} → [{fl_names}]")

    client.close()
    print("\nDone. Reload the mock service if it is running.")


if __name__ == "__main__":
    asyncio.run(seed())
