"""
logging_handler.py — DB-backed logging for admin-service.

DBLogHandler persists WARNING+ log records to the error_logs MongoDB collection
via a background thread queue so request handlers are never blocked.
Uses pymongo (sync) to avoid async-in-sync complexity.

RequestContextFilter enriches every LogRecord with per-request context variables
(request_id, user_id, endpoint, http_method, http_status) that are set by
RequestContextMiddleware at the start of each request.
"""
import logging
import queue
import re
import threading
import traceback
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware

# ── Per-request context vars (set by RequestContextMiddleware) ─────────────
_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
_user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
_endpoint_var: ContextVar[str | None] = ContextVar("endpoint", default=None)
_http_method_var: ContextVar[str | None] = ContextVar("http_method", default=None)
_http_status_var: ContextVar[int | None] = ContextVar("http_status", default=None)

# ── Secret redaction ───────────────────────────────────────────────────────
_REDACT_PATTERNS = [
    (re.compile(r"(Bearer\s+)\S+", re.I), r"\1[REDACTED]"),
    (re.compile(r'"password"\s*:\s*"[^"]*"', re.I), '"password": "[REDACTED]"'),
    (re.compile(r'"token"\s*:\s*"[^"]*"', re.I), '"token": "[REDACTED]"'),
    (re.compile(r'"api_key"\s*:\s*"[^"]*"', re.I), '"api_key": "[REDACTED]"'),
    (re.compile(r'"secret"\s*:\s*"[^"]*"', re.I), '"secret": "[REDACTED]"'),
]


def _redact(text: str) -> str:
    for pattern, repl in _REDACT_PATTERNS:
        text = pattern.sub(repl, text)
    return text


# ── Context filter ─────────────────────────────────────────────────────────
class RequestContextFilter(logging.Filter):
    """Reads context vars (set by middleware) and injects them into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.req_request_id = _request_id_var.get(None)
        record.req_user_id = _user_id_var.get(None)
        record.req_endpoint = _endpoint_var.get(None)
        record.req_http_method = _http_method_var.get(None)
        record.req_http_status = _http_status_var.get(None)
        return True


# ── DB log handler ─────────────────────────────────────────────────────────
class DBLogHandler(logging.Handler):
    """
    Async-safe logging handler that writes to MongoDB via a background thread.
    Drops records silently when the queue is full — never blocks callers.
    Fails safe: any DB write error is printed to stderr and swallowed.
    """

    def __init__(self, mongo_url: str, service_name: str, min_level: int = logging.WARNING):
        super().__init__(min_level)
        self._service = service_name
        self._mongo_url = mongo_url
        self._queue: queue.Queue = queue.Queue(maxsize=2000)
        self._thread = threading.Thread(
            target=self._worker, daemon=True, name="db-log-worker"
        )
        self._thread.start()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self._queue.put_nowait(record)
        except queue.Full:
            pass  # never block request handling

    def _worker(self) -> None:
        try:
            from pymongo import MongoClient  # sync driver — intentional

            client = MongoClient(self._mongo_url, serverSelectionTimeoutMS=5000)
            db_name = (
                self._mongo_url.rstrip("/").split("/")[-1].split("?")[0]
                or "api_gateway_dev"
            )
            col = client[db_name]["error_logs"]
        except Exception as exc:
            print(f"[DBLogHandler] MongoDB connect failed: {exc}", flush=True)
            return

        while True:
            try:
                record: logging.LogRecord = self._queue.get()
                self._persist(col, record)
            except Exception as exc:
                print(f"[DBLogHandler] worker error: {exc}", flush=True)

    def _persist(self, col, record: logging.LogRecord) -> None:
        try:
            message = _redact(record.getMessage())
            stack_trace: str | None = None
            error_type: str | None = None

            if record.exc_info and record.exc_info[0]:
                error_type = record.exc_info[0].__name__
                stack_trace = _redact(
                    "".join(traceback.format_exception(*record.exc_info))
                )

            col.insert_one(
                {
                    "timestamp": datetime.fromtimestamp(
                        record.created, tz=timezone.utc
                    ),
                    "service": self._service,
                    "level": record.levelname,
                    "error_type": error_type,
                    "message": message,
                    "stack_trace": stack_trace,
                    "logger_name": record.name,
                    "module": record.module,
                    "function": record.funcName,
                    "line_no": record.lineno,
                    "request_id": getattr(record, "req_request_id", None),
                    "user_id": getattr(record, "req_user_id", None),
                    "endpoint": getattr(record, "req_endpoint", None),
                    "http_method": getattr(record, "req_http_method", None),
                    "http_status": getattr(record, "req_http_status", None),
                    "extra": None,
                }
            )
        except Exception as exc:
            print(f"[DBLogHandler] persist failed: {exc}", flush=True)


# ── Request context middleware ─────────────────────────────────────────────
class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Sets per-request context vars so DBLogHandler can attach request metadata
    to log records emitted anywhere during request processing.
    """

    async def dispatch(self, request, call_next):
        _request_id_var.set(str(uuid.uuid4())[:12])
        _endpoint_var.set(request.url.path)
        _http_method_var.set(request.method)

        # Extract username from JWT without failing if token is absent/invalid
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            try:
                from app.auth.jwt import decode_token

                payload = decode_token(auth[7:].strip())
                _user_id_var.set(payload.get("sub"))
            except Exception:
                _user_id_var.set(None)
        else:
            _user_id_var.set(None)

        response = await call_next(request)
        _http_status_var.set(response.status_code)
        return response
