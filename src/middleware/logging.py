"""Request logging middleware for FastAPI.

Records every incoming request with method, path, status code, duration,
and a unique request ID for tracing across log entries.
Health-check and documentation endpoints are logged at DEBUG level to reduce
noise in production.
"""

import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

_NOISY_PATHS = frozenset({"/health", "/", "/openapi.json", "/docs", "/redoc"})

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def get_request_id() -> str:
    """Return the current request ID."""
    return request_id_var.get()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs method, path, status code, duration, and request ID for each request."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = str(uuid.uuid4())[:8]
        request_id_var.set(request_id)

        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        path = request.url.path
        log_fn = logger.debug if path in _NOISY_PATHS else logger.info
        log_fn(
            "[%s] %s %s -> %s (%.3fs)",
            request_id,
            request.method,
            path,
            response.status_code,
            duration,
        )
        return response
