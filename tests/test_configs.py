"""Tests for src/util/configs.py — yaml loading, sqlite_file, google_config."""

import json
import os

from src.util.configs import Config


def test_yaml_config_returns_dict():
    result = Config.yaml_config()
    assert isinstance(result, dict)
    assert "sql" in result
    assert "security" in result


def test_yaml_config_is_cached():
    a = Config.yaml_config()
    b = Config.yaml_config()
    assert a is b


def test_sqlite_file_returns_string():
    path = Config.sqlite_file()
    assert isinstance(path, str)
    assert len(path) > 0


def test_sqlite_file_is_cached():
    a = Config.sqlite_file()
    b = Config.sqlite_file()
    assert a == b


def test_google_config_sets_env_vars(tmp_path, monkeypatch):
    secret = {"web": {"client_id": "test-id", "client_secret": "test-secret"}}
    f = tmp_path / "client_secret.json"
    f.write_text(json.dumps(secret))

    # Preserve the real credentials loaded at app startup; restore afterwards
    saved = {k: os.environ.get(k) for k in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")}
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)

    Config._google_configured = False
    try:
        Config.google_config(str(f))
        assert os.environ.get("GOOGLE_CLIENT_ID") == "test-id"
        assert os.environ.get("GOOGLE_CLIENT_SECRET") == "test-secret"
    finally:
        Config._google_configured = True
        for key, value in saved.items():
            if value is not None:
                os.environ[key] = value


def test_google_config_missing_file_raises():
    Config._google_configured = False
    try:
        try:
            Config.google_config("/nonexistent/path.json")
            assert False, "Should have raised FileNotFoundError"
        except FileNotFoundError:
            pass
    finally:
        Config._google_configured = True


def test_google_config_invalid_json_raises(tmp_path):
    f = tmp_path / "bad.json"
    f.write_text("not json{{{")
    Config._google_configured = False
    try:
        try:
            Config.google_config(str(f))
            assert False, "Should have raised ValueError"
        except ValueError:
            pass
    finally:
        Config._google_configured = True


def test_google_config_caches_after_first_call(tmp_path, monkeypatch):
    secret = {"web": {"client_id": "cached-id"}}
    f = tmp_path / "secret.json"
    f.write_text(json.dumps(secret))
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)  # don't leak into real credentials
    Config._google_configured = False
    try:
        Config.google_config(str(f))
        assert Config._google_configured is True
        # Second call should be no-op
        Config.google_config(str(f))
    finally:
        Config._google_configured = True
