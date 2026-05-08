"""
engine.py — Minception core matching logic

Flow:
  1. Receive: method, path, headers, body, query_params
  2. Find gateway by base_path prefix match
  3. Find endpoint by remaining path + method
  4. Iterate flavors by priority DESC — match headers (regex), body (jsonpath), query
  5. Return first matched flavor response
  6. Fallback to is_default=True flavor
  7. Return 404 if nothing matched
"""
import re
import logging
from typing import Any

from jsonpath_ng import parse as jsonpath_parse

from app.models import EngineResult, MockResponse

logger = logging.getLogger(__name__)

# In-memory gateway cache — loaded on startup, reloaded via POST /reload
_gateway_cache: list[dict] = []


def load_configs(gateways: list[dict]) -> None:
    """Replace in-memory cache with fresh configs from MongoDB."""
    global _gateway_cache
    _gateway_cache = gateways
    logger.info(f"Gateway cache loaded: {len(gateways)} gateways")


def get_configs() -> list[dict]:
    return _gateway_cache


def match_request(
    method: str,
    path: str,
    headers: dict[str, str],
    body: Any,
    query_params: dict[str, str],
) -> EngineResult:
    """
    Main entry point. Returns EngineResult with matched flavor or 404.
    """
    method = method.upper()

    for gateway in _gateway_cache:
        if not gateway.get("is_active", True):
            continue

        base_path = gateway.get("base_path", "")
        if not path.startswith(base_path):
            continue

        # Remaining path after stripping base_path
        remaining = path[len(base_path):]
        if not remaining.startswith("/"):
            remaining = "/" + remaining

        for endpoint in gateway.get("endpoints", []):
            if not endpoint.get("is_active", True):
                continue

            ep_method = endpoint.get("method", "").upper()
            ep_path = endpoint.get("path", "")

            if ep_method != method and ep_method != "ANY":
                continue

            if not _path_matches(ep_path, remaining):
                continue

            # Found the endpoint — now pick the best flavor
            result = _pick_flavor(endpoint.get("flavors", []), headers, body, query_params)
            if result:
                return result

    # Nothing matched
    return EngineResult(
        matched=False,
        response=MockResponse(
            status=404,
            body={"error": "No matching gateway/endpoint/flavor found"},
        ),
    )


def _path_matches(pattern: str, path: str) -> bool:
    """
    Match endpoint path pattern against incoming path.
    Supports exact match and simple wildcards: /users/{id} → regex
    """
    # Convert path params like {id} to regex groups
    regex_pattern = re.sub(r"\{[^}]+\}", r"[^/]+", pattern)
    regex_pattern = f"^{regex_pattern}$"
    return bool(re.match(regex_pattern, path))


def _pick_flavor(
    flavors: list[dict],
    headers: dict[str, str],
    body: Any,
    query_params: dict[str, str],
) -> EngineResult | None:
    """
    Iterate flavors by priority DESC.
    Return first matching flavor, or default flavor, or None.
    """
    # Sort by priority descending; default flavors at the end
    sorted_flavors = sorted(
        flavors,
        key=lambda f: (not f.get("is_default", False), -f.get("priority", 0)),
    )

    default_flavor: dict | None = None

    for flavor in sorted_flavors:
        if not flavor.get("is_active", True):
            continue

        if flavor.get("is_default", False):
            default_flavor = flavor
            continue  # Try non-default first

        match_rules = flavor.get("match", {})
        if _matches_all(match_rules, headers, body, query_params):
            return _build_result(flavor, matched=True)

    # Fall back to default
    if default_flavor:
        return _build_result(default_flavor, matched=True)

    return None


def _matches_all(
    rules: dict,
    headers: dict[str, str],
    body: Any,
    query_params: dict[str, str],
) -> bool:
    """All defined match rules must pass."""
    if rules.get("headers") and not _match_headers(rules["headers"], headers):
        return False
    if rules.get("body") and not _match_body(rules["body"], body):
        return False
    if rules.get("query") and not _match_query(rules["query"], query_params):
        return False
    return True


def _match_headers(patterns: dict[str, str], headers: dict[str, str]) -> bool:
    """Match request headers against regex patterns (case-insensitive keys)."""
    lower_headers = {k.lower(): v for k, v in headers.items()}
    for key, pattern in patterns.items():
        value = lower_headers.get(key.lower(), "")
        if not re.search(pattern, value):
            return False
    return True


def _match_body(patterns: dict[str, Any], body: Any) -> bool:
    """Match request body using jsonpath expressions."""
    if not isinstance(body, dict):
        return False
    for jsonpath_expr, expected in patterns.items():
        try:
            matches = jsonpath_parse(jsonpath_expr).find(body)
            if not matches:
                return False
            actual = str(matches[0].value)
            if not re.search(str(expected), actual):
                return False
        except Exception as e:
            logger.warning(f"jsonpath error for '{jsonpath_expr}': {e}")
            return False
    return True


def _match_query(patterns: dict[str, str], query_params: dict[str, str]) -> bool:
    """Match query parameters (full-string regex match)."""
    for key, pattern in patterns.items():
        value = query_params.get(key, "")
        if not re.fullmatch(pattern, value):
            return False
    return True


def _build_result(flavor: dict, matched: bool) -> EngineResult:
    response_data = flavor.get("response", {})
    return EngineResult(
        matched=matched,
        flavor_name=flavor.get("name"),
        response=MockResponse(
            status=response_data.get("status", 200),
            headers=response_data.get("headers", {}),
            body=response_data.get("body"),
            delay_ms=response_data.get("delay_ms", 0),
        ),
    )
