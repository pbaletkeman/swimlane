"""Buffer coverage: auth JWT helpers, origin validation, oauth2user, encryption/config error branches."""

from __future__ import annotations

import importlib
import logging
from datetime import timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwt as jose_jwt

from src.encryption import decrypt_field
from src.env import TOKEN_SECRET_KEY

# --- Token helpers (src/routes/auth_routes.py) --------------------------

def _ar():
    from src.routes.auth_routes import create_local_access_token, create_refresh_token
    return create_local_access_token, create_refresh_token


def test_create_tokens_embed_type_and_exp(client: TestClient, seed: dict) -> None:
    access, refresh = _ar()
    a = access({"sub": "t-m1", "role": "member"})
    r = refresh({"sub": "t-m1", "role": "member"})

    ap = jose_jwt.decode(a, TOKEN_SECRET_KEY, algorithms=["HS256"])
    rp = jose_jwt.decode(r, TOKEN_SECRET_KEY, algorithms=["HS256"])
    assert ap["type"] == "access" and ap["sub"] == "t-m1"
    assert rp["type"] == "refresh"
    assert ap["exp"] - rp["exp"] < 0  # access expires sooner than refresh


def test_create_tokens_custom_expiry(client: TestClient, seed: dict) -> None:
    from src.routes.auth_routes import create_local_access_token

    tok = create_local_access_token({"sub": "x", "role": "member"}, expires_delta=timedelta(hours=1))
    payload = jose_jwt.decode(tok, TOKEN_SECRET_KEY, algorithms=["HS256"])
    assert payload["exp"] > 0


def test_verify_token_happy_and_type_mismatch(client: TestClient, seed: dict) -> None:
    from src.routes.auth_routes import verify_token

    access, refresh = _ar()
    data = verify_token(access({"sub": "t-m1", "role": "member"}), expected_type="access")
    assert data.sub == "t-m1"

    with pytest.raises(HTTPException) as wrong:
        verify_token(refresh({"sub": "t-m1", "role": "member"}), expected_type="access")
    assert wrong.value.status_code == 401


def test_verify_token_expired_and_garbage(client: TestClient, seed: dict) -> None:
    from src.routes.auth_routes import verify_token

    expired = jose_jwt.encode(
        {"sub": "t-m1", "role": "member", "type": "access", "exp": 1000},
        TOKEN_SECRET_KEY,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        verify_token(expired, expected_type="access")
    assert exc.value.status_code == 401

    with pytest.raises(HTTPException) as bad:
        verify_token("not-a-jwt", expected_type="access")
    assert bad.value.status_code == 401


def test_refresh_access_token_success_and_unknown_user(client: TestClient, seed: dict) -> None:
    from src.routes.auth_routes import refresh_access_token

    _, create_refresh = _ar()
    out = refresh_access_token(create_refresh({"sub": "t-m1", "role": "whatever-old"}))
    assert out["token_type"] == "bearer"
    claims = jose_jwt.decode(out["access_token"], TOKEN_SECRET_KEY, algorithms=["HS256"])
    assert claims["role"] == "member"  # role re-baked from the DB

    with pytest.raises(HTTPException) as exc:
        refresh_access_token(create_refresh({"sub": "ghost-user", "role": "member"}))
    assert exc.value.status_code == 401


def test_local_frontend_origin_validation(client: TestClient, seed: dict) -> None:
    from src.routes.auth_routes import _local_frontend_origin

    assert _local_frontend_origin(None) is None
    assert _local_frontend_origin("") is None
    assert _local_frontend_origin("http://localhost:5173") == "http://localhost:5173"
    assert _local_frontend_origin("http://localhost") == "http://localhost"
    assert _local_frontend_origin("https://127.0.0.1:4173") == "https://127.0.0.1:4173"
    assert _local_frontend_origin("not a url") is None
    assert _local_frontend_origin("ftp://localhost:5173") is None
    assert _local_frontend_origin("http://evil.example.com") is None
    assert _local_frontend_origin("http://localhost:5173/path?q=1") == "http://localhost:5173"


def test_oauth2user_encrypts_profile(client: TestClient, seed: dict) -> None:
    from src.routes.auth_routes import AuthRoutes

    user = AuthRoutes().oauth2user(
        {"sub": "g-123", "given_name": "Ada", "family_name": "Lovelace", "email": "Ada@Example.com"}
    )
    assert user.sub == "g-123"
    fn_nonce, fn_ct = user.first_name_nonce or "", user.first_name_ciphertext or ""
    ln_nonce, ln_ct = user.last_name_nonce or "", user.last_name_ciphertext or ""
    em_nonce, em_ct = user.email_nonce or "", user.email_ciphertext or ""
    assert decrypt_field(fn_nonce, fn_ct) == "Ada"
    assert decrypt_field(ln_nonce, ln_ct) == "Lovelace"
    assert decrypt_field(em_nonce, em_ct) == "Ada@Example.com"


def test_auth_callback_without_code_serves_devtools(client: TestClient, seed: dict) -> None:
    r = client.get("/auth/callback")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Swimlane" in r.text or "devtools" in r.text.lower()


def test_devtools_page(client: TestClient, seed: dict) -> None:
    r = client.get("/devtools")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_profile_alias_matches_me(client: TestClient, seed: dict) -> None:
    me = client.get("/me", headers=seed["m1"])
    profile = client.get("/profile", headers=seed["m1"])
    assert me.status_code == profile.status_code == 200
    assert me.json() == profile.json()


# --- Encryption key-loading error branches ------------------------------


def test_load_key_from_env_missing(monkeypatch) -> None:
    monkeypatch.delenv("APP_AES_KEY", raising=False)
    import src.env as env_mod

    monkeypatch.setattr(env_mod, "ENCRYPTION_KEY_ENV_VAR", "")
    import src.encryption as enc

    with pytest.raises(RuntimeError, match="APP_AES_KEY not set"):
        importlib.reload(enc)


def test_load_key_from_env_wrong_length(monkeypatch) -> None:
    import base64

    monkeypatch.setenv("APP_AES_KEY", base64.b64encode(b"short").decode())
    import src.encryption as enc

    with pytest.raises(RuntimeError, match="32 bytes"):
        importlib.reload(enc)


@pytest.fixture(autouse=True)
def _restore_encryption_module():
    """Reload src.encryption with pristine env after each key-env test."""
    yield
    import src.encryption as enc

    importlib.reload(enc)


# --- Config provider branches -------------------------------------------


def test_config_postgresql_not_implemented(monkeypatch) -> None:
    from src.util.configs import Config

    monkeypatch.setattr(
        Config, "_yaml_cache",
        {"sql": {"active": "postgresql", "providers": {"postgresql": {}}}},
        raising=False,
    )
    with pytest.raises(NotImplementedError):
        Config()


def test_config_unknown_driver_warns(caplog, monkeypatch) -> None:
    from src.util.configs import Config

    monkeypatch.setattr(
        Config, "_yaml_cache",
        {"sql": {"active": "mongodb", "providers": {}}},
        raising=False,
    )
    with caplog.at_level(logging.WARNING):
        cfg = Config()
    assert cfg.db is None
    assert any("Unknown SQL driver" in rec.message for rec in caplog.records)
