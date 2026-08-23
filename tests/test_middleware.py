"""Tests for src/middleware/logging.py — request logging, correlation IDs."""

from fastapi import FastAPI

from src.middleware.logging import RequestLoggingMiddleware, get_request_id


def test_middleware_adds_request_id():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/test")
    def test_route():
        return {"request_id": get_request_id()}

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        r = client.get("/test")
        assert r.status_code == 200
        rid = r.json()["request_id"]
        assert rid != "-"
        assert len(rid) == 8


def test_middleware_unique_request_ids():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/test")
    def test_route():
        return {"request_id": get_request_id()}

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        r1 = client.get("/test")
        r2 = client.get("/test")
        assert r1.json()["request_id"] != r2.json()["request_id"]


def test_health_path_not_raised():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
