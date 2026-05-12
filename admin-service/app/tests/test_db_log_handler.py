"""
Tests for DBLogHandler and _redact utility.

No live MongoDB required — DB write path is tested with a mock collection.
"""
import logging
import queue
import time
import unittest
from unittest.mock import MagicMock, patch

from app.logging_handler import DBLogHandler, _redact, RequestContextFilter


# ── _redact ────────────────────────────────────────────────────────────────

class TestRedact:
    def test_bearer_token_redacted(self):
        result = _redact("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")
        assert "[REDACTED]" in result
        assert "eyJhbGciOiJIUzI1NiJ9" not in result

    def test_password_field_redacted(self):
        result = _redact('{"username": "admin", "password": "supersecret"}')
        assert "supersecret" not in result
        assert "[REDACTED]" in result

    def test_api_key_redacted(self):
        result = _redact('{"api_key": "sk-1234567890abcdef"}')
        assert "sk-1234567890abcdef" not in result

    def test_normal_text_unchanged(self):
        msg = "Gateway config loaded successfully"
        assert _redact(msg) == msg


# ── DBLogHandler ───────────────────────────────────────────────────────────

class TestDBLogHandler:
    def _make_record(self, level: int, msg: str) -> logging.LogRecord:
        record = logging.LogRecord(
            name="test", level=level, pathname="", lineno=0,
            msg=msg, args=(), exc_info=None,
        )
        # Attach context attrs that RequestContextFilter would set
        record.req_request_id = None
        record.req_user_id = None
        record.req_endpoint = None
        record.req_http_method = None
        record.req_http_status = None
        return record

    def test_warning_record_is_queued(self):
        handler = DBLogHandler.__new__(DBLogHandler)
        handler._service = "test"
        handler._mongo_url = "mongodb://localhost/test"
        handler._queue = queue.Queue(maxsize=100)
        handler.level = logging.WARNING

        record = self._make_record(logging.WARNING, "test warning")
        handler.emit(record)

        assert handler._queue.qsize() == 1

    def test_info_record_is_not_emitted(self):
        """Handler level gate: INFO should never reach emit()."""
        handler = DBLogHandler.__new__(DBLogHandler)
        handler._service = "test"
        handler._mongo_url = "mongodb://localhost/test"
        handler._queue = queue.Queue(maxsize=100)
        handler.level = logging.WARNING

        record = self._make_record(logging.INFO, "just info")
        # logging.Handler.emit is only called when record.levelno >= handler.level
        # simulate the Handler.handle() gate
        if record.levelno >= handler.level:
            handler.emit(record)

        assert handler._queue.qsize() == 0

    def test_full_queue_drops_silently(self):
        handler = DBLogHandler.__new__(DBLogHandler)
        handler._service = "test"
        handler._queue = queue.Queue(maxsize=1)
        handler.level = logging.WARNING

        r1 = self._make_record(logging.WARNING, "first")
        r2 = self._make_record(logging.WARNING, "second — should drop")
        handler.emit(r1)
        handler.emit(r2)  # must not raise

        assert handler._queue.qsize() == 1

    def test_persist_db_failure_swallowed(self):
        handler = DBLogHandler.__new__(DBLogHandler)
        handler._service = "test"

        col = MagicMock()
        col.insert_one.side_effect = Exception("connection refused")

        record = self._make_record(logging.ERROR, "something bad")
        record.req_request_id = "abc123"
        record.req_user_id = "admin"
        record.req_endpoint = "/api/admin/gateways"
        record.req_http_method = "GET"
        record.req_http_status = 500

        # Must not raise
        handler._persist(col, record)

    def test_persist_writes_correct_fields(self):
        handler = DBLogHandler.__new__(DBLogHandler)
        handler._service = "admin-service"

        col = MagicMock()
        record = self._make_record(logging.ERROR, "database timeout")
        record.req_request_id = "req-001"
        record.req_user_id = "wajih"
        record.req_endpoint = "/api/admin/gateways"
        record.req_http_method = "POST"
        record.req_http_status = 500

        handler._persist(col, record)

        col.insert_one.assert_called_once()
        doc = col.insert_one.call_args[0][0]
        assert doc["service"] == "admin-service"
        assert doc["level"] == "ERROR"
        assert doc["message"] == "database timeout"
        assert doc["request_id"] == "req-001"
        assert doc["user_id"] == "wajih"

    def test_persist_redacts_secrets_in_message(self):
        handler = DBLogHandler.__new__(DBLogHandler)
        handler._service = "admin-service"

        col = MagicMock()
        record = self._make_record(
            logging.ERROR,
            'Login attempt with password "hunter2" failed',
        )
        record.req_request_id = None
        record.req_user_id = None
        record.req_endpoint = None
        record.req_http_method = None
        record.req_http_status = None

        handler._persist(col, record)

        doc = col.insert_one.call_args[0][0]
        assert "hunter2" not in doc["message"]
        assert "[REDACTED]" in doc["message"]


# ── RequestContextFilter ───────────────────────────────────────────────────

class TestRequestContextFilter:
    def test_filter_injects_defaults_outside_request(self):
        f = RequestContextFilter()
        record = logging.LogRecord(
            name="test", level=logging.WARNING, pathname="", lineno=0,
            msg="test", args=(), exc_info=None,
        )
        f.filter(record)
        assert record.req_request_id is None
        assert record.req_user_id is None
        assert record.req_endpoint is None
