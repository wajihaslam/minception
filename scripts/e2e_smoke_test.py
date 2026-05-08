#!/usr/bin/env python3
"""
scripts/e2e_smoke_test.py — Minception End-to-End Smoke Test
=============================================================

Hits real running services. Run AFTER `docker compose -f docker-compose.local.yml up`.

What it tests (in order):
  1.  Health checks       — both services respond
  2.  Admin login         — JWT token returned
  3.  List gateways       — auth header accepted
  4.  Create gateway      — 201 + id stored
  5.  Create endpoint     — 201 + id stored
  6.  Create flavor       — 201
  7.  Trigger reload      — mock reloads from DB
  8.  Hit mock endpoint   — pong response returned
  9.  Verify log recorded — request log appears in admin API
  10. Cleanup             — gateway soft-deleted + reload triggered
  11. Mock returns 404    — deleted gateway no longer matched

Usage:
    python scripts/e2e_smoke_test.py
    python scripts/e2e_smoke_test.py --base-admin http://localhost:8002 --base-mock http://localhost:8001

Exit code: 0 if all steps pass, 1 if any fail.
"""

import argparse
import sys
import time

import httpx

# ── ANSI colour helpers ────────────────────────────────────────────────────────

GREEN  = "\033[32m"
RED    = "\033[31m"
YELLOW = "\033[33m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def green(s: str) -> str:  return f"{GREEN}{s}{RESET}"
def red(s: str) -> str:    return f"{RED}{s}{RESET}"
def yellow(s: str) -> str: return f"{YELLOW}{s}{RESET}"
def bold(s: str) -> str:   return f"{BOLD}{s}{RESET}"


# ── Smoke test runner ──────────────────────────────────────────────────────────

class SmokeTest:
    def __init__(self, base_admin: str, base_mock: str) -> None:
        self.base_admin   = base_admin.rstrip("/")
        self.base_mock    = base_mock.rstrip("/")
        self.client       = httpx.Client(timeout=10.0)
        self.token        = ""
        self.gateway_id   = ""
        self.endpoint_id  = ""
        self.results: list[tuple[str, bool, str]] = []

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def _record(self, label: str, passed: bool, detail: str = "") -> bool:
        self.results.append((label, passed, detail))
        tag    = green("PASS") if passed else red("FAIL")
        suffix = f"  {detail}" if detail else ""
        print(f"  [{tag}]  {label}{suffix}")
        return passed

    def _step(self, number: int, title: str) -> None:
        print(f"\n{bold(f'Step {number} — {title}')}")

    # ── Steps ──────────────────────────────────────────────────────────────────

    def step1_health(self) -> None:
        self._step(1, "Health checks")

        # Mock Service — returns {"status": "healthy"|"degraded", ...}
        try:
            r    = self.client.get(f"{self.base_mock}/health")
            body = r.json()
            svc_status = body.get("status", "")
            passed = r.status_code == 200 and svc_status in ("ok", "healthy")
            self._record(
                "Mock Service  GET /health",
                passed,
                f"HTTP {r.status_code}  status={svc_status!r}",
            )
        except Exception as exc:
            self._record("Mock Service  GET /health", False, str(exc))

        # Admin Service — returns {"success": true, "data": {"status": "healthy"|"degraded", ...}}
        try:
            r    = self.client.get(f"{self.base_admin}/health")
            body = r.json()
            svc_status = (body.get("data") or {}).get("status", "")
            passed = r.status_code == 200 and svc_status in ("ok", "healthy")
            self._record(
                "Admin Service GET /health",
                passed,
                f"HTTP {r.status_code}  status={svc_status!r}",
            )
        except Exception as exc:
            self._record("Admin Service GET /health", False, str(exc))

    def step2_login(self) -> bool:
        self._step(2, "Admin login")
        try:
            r = self.client.post(
                f"{self.base_admin}/api/auth/login",
                json={"username": "admin", "password": "changeme123"},
            )
            body  = r.json()
            # Shape: {"success": true, "data": {"access_token": "...", ...}}
            token = (body.get("data") or {}).get("access_token", "")
            passed = r.status_code == 200 and bool(token)
            self._record("POST /api/auth/login", passed, f"HTTP {r.status_code}  token={'yes' if token else 'missing'}")
            if passed:
                self.token = token
            return passed
        except Exception as exc:
            self._record("POST /api/auth/login", False, str(exc))
            return False

    def step3_list_gateways(self) -> None:
        self._step(3, "List gateways (authenticated)")
        try:
            r = self.client.get(f"{self.base_admin}/api/admin/gateways/", headers=self._auth())
            body  = r.json()
            items = (body.get("data") or [])
            count = len(items) if isinstance(items, list) else "?"
            passed = r.status_code == 200 and isinstance(items, list)
            self._record("GET /api/admin/gateways/", passed, f"HTTP {r.status_code}  count={count}")
        except Exception as exc:
            self._record("GET /api/admin/gateways/", False, str(exc))

    def step4_create_gateway(self) -> bool:
        self._step(4, "Create test gateway")
        try:
            r = self.client.post(
                f"{self.base_admin}/api/admin/gateways/",
                json={
                    "name":        "E2E Test Gateway",
                    "base_path":   "/e2e-test",
                    "description": "Smoke test — safe to delete",
                    "is_active":   True,
                },
                headers=self._auth(),
            )
            body   = r.json()
            data   = body.get("data") or {}
            gw_id  = data.get("id", "")
            passed = r.status_code == 201 and bool(gw_id)
            self._record(
                "POST /api/admin/gateways/",
                passed,
                f"HTTP {r.status_code}  id={gw_id!r}",
            )
            if passed:
                self.gateway_id = gw_id
            return passed
        except Exception as exc:
            self._record("POST /api/admin/gateways/", False, str(exc))
            return False

    def step5_create_endpoint(self) -> bool:
        self._step(5, "Create test endpoint")
        url = f"{self.base_admin}/api/admin/gateways/{self.gateway_id}/endpoints"
        try:
            r = self.client.post(
                url,
                json={"path": "/ping", "method": "GET", "description": "E2E test endpoint"},
                headers=self._auth(),
            )
            body   = r.json()
            data   = body.get("data") or {}
            ep_id  = data.get("id", "")
            passed = r.status_code == 201 and bool(ep_id)
            self._record(
                f"POST /api/admin/gateways/{self.gateway_id}/endpoints",
                passed,
                f"HTTP {r.status_code}  id={ep_id!r}",
            )
            if passed:
                self.endpoint_id = ep_id
            return passed
        except Exception as exc:
            self._record(f"POST .../endpoints", False, str(exc))
            return False

    def step6_create_flavor(self) -> bool:
        self._step(6, "Create test flavor")
        url = (
            f"{self.base_admin}/api/admin/gateways/{self.gateway_id}"
            f"/endpoints/{self.endpoint_id}/flavors"
        )
        try:
            r = self.client.post(
                url,
                json={
                    "name":       "pong",
                    "priority":   0,
                    "is_default": True,
                    "match":      {},
                    "response": {
                        "status":   200,
                        "headers":  {"Content-Type": "application/json"},
                        "body":     {"pong": True},
                        "delay_ms": 0,
                    },
                },
                headers=self._auth(),
            )
            passed = r.status_code == 201
            self._record("POST .../endpoints/{id}/flavors", passed, f"HTTP {r.status_code}")
            return passed
        except Exception as exc:
            self._record("POST .../endpoints/{id}/flavors", False, str(exc))
            return False

    def step7_reload(self) -> None:
        self._step(7, "Trigger mock reload")
        try:
            r      = self.client.post(f"{self.base_mock}/reload")
            body   = r.json()
            # Shape: {"success": true, "data": {"configs_loaded": N}, "error": null}
            ok     = body.get("success") is True
            loaded = (body.get("data") or {}).get("configs_loaded", "?")
            passed = r.status_code == 200 and ok
            self._record("POST /reload", passed, f"HTTP {r.status_code}  configs_loaded={loaded}")
        except Exception as exc:
            self._record("POST /reload", False, str(exc))

    def step8_hit_mock(self) -> None:
        self._step(8, "Hit mock endpoint")
        # The mock catch-all is /mock/{full_path}, so /mock/e2e-test/ping maps to
        # gateway base_path=/e2e-test  +  endpoint path=/ping
        try:
            r      = self.client.get(f"{self.base_mock}/mock/e2e-test/ping")
            ct     = r.headers.get("content-type", "")
            body   = r.json() if "application/json" in ct else {}
            pong   = body.get("pong")
            passed = r.status_code == 200 and pong is True
            self._record(
                "GET /mock/e2e-test/ping",
                passed,
                f"HTTP {r.status_code}  body={body}",
            )
        except Exception as exc:
            self._record("GET /mock/e2e-test/ping", False, str(exc))

    def step9_verify_log(self) -> None:
        self._step(9, "Verify request log recorded")
        # Log shape: {"success": true, "data": {"logs": [...], "total": N, ...}}
        # The mock logs every request to request_logs — step 8 should have created one.
        # We sort by timestamp desc so the most recent entry is first.
        try:
            r      = self.client.get(f"{self.base_admin}/api/admin/logs/", headers=self._auth())
            body   = r.json()
            data   = body.get("data") or {}
            logs   = data.get("logs", [])
            total  = data.get("total", 0)
            passed = r.status_code == 200 and isinstance(logs, list) and total > 0
            self._record(
                "GET /api/admin/logs/",
                passed,
                f"HTTP {r.status_code}  total={total}",
            )
        except Exception as exc:
            self._record("GET /api/admin/logs/", False, str(exc))

    def step10_delete_gateway(self) -> bool:
        self._step(10, "Cleanup — delete test gateway")
        # DELETE is a soft-delete (sets is_active=False) and calls /reload internally.
        # Returns 200 {"success": true, "data": {"id": ..., "is_active": false}}.
        url = f"{self.base_admin}/api/admin/gateways/{self.gateway_id}"
        try:
            r      = self.client.delete(url, headers=self._auth())
            passed = r.status_code in (200, 204)
            self._record(
                f"DELETE /api/admin/gateways/{self.gateway_id}",
                passed,
                f"HTTP {r.status_code}",
            )
            return passed
        except Exception as exc:
            self._record(f"DELETE /api/admin/gateways/{self.gateway_id}", False, str(exc))
            return False

    def step11_verify_gone(self) -> None:
        self._step(11, "Verify mock no longer matches deleted gateway")
        # The delete handler calls trigger_reload() before returning, so the mock
        # should already have unloaded the gateway. A small sleep guards against
        # any in-flight reload latency.
        time.sleep(0.5)
        try:
            r      = self.client.get(f"{self.base_mock}/mock/e2e-test/ping")
            passed = r.status_code == 404
            self._record(
                "GET /mock/e2e-test/ping  (expect 404)",
                passed,
                f"HTTP {r.status_code}",
            )
        except Exception as exc:
            self._record("GET /mock/e2e-test/ping  (expect 404)", False, str(exc))

    # ── Partial cleanup (called when a mid-run step fails) ─────────────────────

    def _cleanup_partial(self) -> None:
        if not self.gateway_id or not self.token:
            return
        print(f"\n{yellow('Cleaning up partial test data…')}")
        try:
            self.client.delete(
                f"{self.base_admin}/api/admin/gateways/{self.gateway_id}",
                headers=self._auth(),
            )
            print(f"  {yellow('Deleted gateway')} {self.gateway_id}")
        except Exception as exc:
            print(f"  {red('Cleanup failed:')} {exc}")

    # ── Summary table ──────────────────────────────────────────────────────────

    def _summarize(self) -> int:
        total  = len(self.results)
        passed = sum(1 for _, ok, _ in self.results if ok)
        failed = total - passed

        width = max((len(label) for label, _, _ in self.results), default=40) + 2

        print(f"\n{'─' * (width + 18)}")
        print(bold("  Results"))
        print(f"{'─' * (width + 18)}")

        for label, ok, detail in self.results:
            mark   = green("✔") if ok else red("✘")
            detail_str = f"  {detail}" if detail else ""
            print(f"  {mark}  {label:<{width}}{detail_str}")

        print(f"{'─' * (width + 18)}")

        if failed == 0:
            verdict = green("ALL PASSED")
        else:
            verdict = red(f"{failed} FAILED")

        print(f"  Total {total}  ·  {green(str(passed))} passed  ·  {red(str(failed))} failed  ·  {verdict}")
        print(f"{'─' * (width + 18)}\n")

        return 0 if failed == 0 else 1

    # ── Entry point ────────────────────────────────────────────────────────────

    def run(self) -> int:
        print(f"\n{bold('Minception — E2E Smoke Test')}")
        print(f"  Admin Service : {self.base_admin}")
        print(f"  Mock Service  : {self.base_mock}")
        print()

        # ── Step 1: health (non-blocking) ──────────────────────────────────────
        self.step1_health()

        # ── Step 2: login (abort if fails — nothing works without a token) ─────
        if not self.step2_login():
            print(f"\n{red('Cannot continue without an auth token — aborting.')}")
            return self._summarize()

        # ── Step 3: list (non-blocking) ────────────────────────────────────────
        self.step3_list_gateways()

        # ── Step 4: create gateway (abort if fails) ────────────────────────────
        if not self.step4_create_gateway():
            print(f"\n{red('Cannot continue without a gateway — aborting.')}")
            return self._summarize()

        # ── Step 5: create endpoint ────────────────────────────────────────────
        if not self.step5_create_endpoint():
            self._cleanup_partial()
            return self._summarize()

        # ── Step 6: create flavor ──────────────────────────────────────────────
        if not self.step6_create_flavor():
            self._cleanup_partial()
            return self._summarize()

        # ── Steps 7–11: reload, hit mock, verify log, delete, verify gone ──────
        self.step7_reload()
        self.step8_hit_mock()
        self.step9_verify_log()
        self.step10_delete_gateway()
        self.step11_verify_gone()

        return self._summarize()


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Minception E2E Smoke Test — requires Docker stack to be running",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--base-admin",
        default="http://localhost:8002",
        help="Admin Service base URL",
    )
    parser.add_argument(
        "--base-mock",
        default="http://localhost:8001",
        help="Mock Service base URL",
    )
    args = parser.parse_args()

    test = SmokeTest(base_admin=args.base_admin, base_mock=args.base_mock)
    sys.exit(test.run())


if __name__ == "__main__":
    main()
