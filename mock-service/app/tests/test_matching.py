"""
Unit tests for individual matching functions in engine.py

Run: cd mock-service && pytest app/tests/test_matching.py -v
"""
import pytest
from app.engine import _match_headers, _match_body, _match_query, _path_matches


class TestHeaderMatching:
    def test_exact_header_match(self):
        assert _match_headers({"Content-Type": "application/json"}, {"content-type": "application/json"})

    def test_regex_header_match(self):
        assert _match_headers({"Authorization": "Bearer admin_.*"}, {"authorization": "Bearer admin_token"})

    def test_header_regex_no_match(self):
        assert not _match_headers({"Authorization": "Bearer admin_.*"}, {"authorization": "Bearer user_token"})

    def test_missing_header_fails(self):
        assert not _match_headers({"X-Custom": "value"}, {})

    def test_empty_patterns_always_match(self):
        assert _match_headers({}, {"anything": "here"})


class TestBodyMatching:
    def test_jsonpath_exact_match(self):
        assert _match_body({"$.role": "admin"}, {"role": "admin"})

    def test_jsonpath_nested_match(self):
        assert _match_body({"$.user.role": "editor"}, {"user": {"role": "editor"}})

    def test_jsonpath_no_match(self):
        assert not _match_body({"$.role": "admin"}, {"role": "viewer"})

    def test_missing_jsonpath_key(self):
        assert not _match_body({"$.role": "admin"}, {"username": "wajih"})

    def test_empty_body_value_match(self):
        assert _match_body({"$.email": ""}, {"email": ""})

    def test_non_dict_body_fails(self):
        assert not _match_body({"$.role": "admin"}, "raw string")

    def test_empty_patterns_always_match(self):
        assert _match_body({}, {"anything": "here"})


class TestQueryMatching:
    def test_exact_query_match(self):
        assert _match_query({"page": "1"}, {"page": "1"})

    def test_regex_query_match(self):
        assert _match_query({"page": "\\d+"}, {"page": "42"})

    def test_query_no_match(self):
        assert not _match_query({"status": "active"}, {"status": "inactive"})

    def test_missing_query_param(self):
        assert not _match_query({"page": "1"}, {})

    def test_empty_patterns_always_match(self):
        assert _match_query({}, {"anything": "here"})


class TestPathMatching:
    def test_exact_path(self):
        assert _path_matches("/users/create", "/users/create")

    def test_path_with_param(self):
        assert _path_matches("/users/{id}", "/users/123")

    def test_path_with_multiple_params(self):
        assert _path_matches("/gateways/{gid}/endpoints/{eid}", "/gateways/abc/endpoints/def")

    def test_path_no_match(self):
        assert not _path_matches("/users/create", "/users/delete")

    def test_path_partial_no_match(self):
        assert not _path_matches("/users/{id}", "/users/123/extra")
