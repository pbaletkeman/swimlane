# Logging Plan

## Current Logging Status

**Logging infrastructure is fully implemented.** The project now has:

- **Centralized logging** via `src/util/logging.py` with `setup_logging()`
- **Structured logging** with text and JSON formatters
- **Request logging middleware** with UUID correlation IDs
- **Component-level logging** for auth, database, encryption, and config
- **Environment variable support** for `LOG_LEVEL`, `LOG_FORMAT`, and `LOG_FILE`

---

## Recommended Logging Setup

### 1. Core Logging Configuration ✅
- Use Python's standard `logging` module with a centralized config
- Support `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` levels
- Configure via environment variable `LOG_LEVEL` (default: `INFO` in production, `DEBUG` in development)

### 2. Structured Logging ✅
- Use `logging.Formatter` with timestamps, module names, log levels
- Example format: `%(asctime)s | %(levelname)-8s | %(name)s | %(message)s`
- For production, consider JSON-formatted logs (easier to parse in log aggregators)

### 3. Log Levels Guide ✅

| Level | When to Use |
|-------|-------------|
| `DEBUG` | Detailed diagnostic info (SQL queries, config values, request headers) |
| `INFO` | Normal operations (server start, request completed, user logged in) |
| `WARNING` | Unexpected but recoverable (deprecated config, missing optional field) |
| `ERROR` | Operation failed (DB error, auth failure, validation error) |
| `CRITICAL` | System-level failure (can't start server, can't connect to DB) |

### 4. What to Log by Component ✅

| Component | What to Log |
|-----------|-------------|
| **Startup** | Config loaded, DB connected, OAuth configured, server listening on port |
| **Auth Routes** | Login attempts (user sub), token issuance, token refresh, logout |
| **Route Handlers** | Request method, path, status code, duration |
| **Database** | Connection errors, query failures (never log full queries with PII) |
| **Encryption** | Encryption/decryption failures (never log keys, nonces, or plaintext) |
| **Config** | Config file loaded, DB driver selected, missing optional config |

### 5. Middleware for Request Logging ✅
- Log every request with: method, path, status code, response time
- Use FastAPI's `BaseHTTPMiddleware` or `starlette.middleware.base`
- Add request ID (UUID) for tracing across logs

### 6. Log Output Destinations ✅
- **Development**: Console (stdout) with `DEBUG` level
- **Production**: Console (stdout) with `INFO` level (for containerized deployments)
- **Optional**: File with `RotatingFileHandler` for non-containerized production

---

## Security Rules (CRITICAL)

**Never log the following:**
- PII (names, emails) — even encrypted ciphertext
- JWT tokens or refresh tokens
- Encryption keys (`APP_AES_KEY`, `ENCRYPTION_KEY`)
- Google OAuth client secrets
- Database passwords or connection strings
- User IDs from session data (log `sub` only for auth events)

**Safe to log:**
- HTTP method, path, status code
- Request duration
- Anonymous user actions (e.g., "login attempted")
- Error types and stack traces (sanitized)

---

## Files to Create/Modify ✅

### New Files
1. `src/util/logging.py` — centralized logging setup ✅
2. `src/middleware/logging.py` — request logging middleware ✅

### Modify Files
3. `main.py` — call `setup_logging()` at startup, add logging middleware ✅
4. `config.yaml` — add `logging:` section ✅
5. `src/util/configs.py` — replace `print()` with `logging.warning()` ✅
6. `src/routes/auth_routes.py` — log auth events ✅
7. `src/routes/*_routes.py` — add error logging in exception handlers ✅
8. `src/data/*/sqlite.py` — log connection/query errors ✅
9. `src/encryption.py` — log encryption/decryption failures ✅

---

## Implementation Details

### `src/util/logging.py`
```python
import logging
import sys
import os
from logging.handlers import RotatingFileHandler


def setup_logging():
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    handlers = [logging.StreamHandler(sys.stdout)]

    # Optional: File logging for non-containerized deployments
    log_file = os.environ.get("LOG_FILE")
    if log_file:
        os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=5_000_000,
            backupCount=5,  # 5MB, keep 5 backups
        )
        handlers.append(file_handler)

    logging.basicConfig(
        level=getattr(logging, level),
        format=fmt,
        handlers=handlers,
    )
```

### `src/middleware/logging.py`
```python
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        logger.info(
            "%s %s -> %s (%.3fs)",
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )
        return response
```

### Environment Variables
```bash
# Development
LOG_LEVEL=DEBUG

# Production
LOG_LEVEL=INFO
LOG_FILE=logs/app.log  # Optional: enables file logging
```

### `config.yaml` addition
```yaml
logging:
  level: INFO  # Override with LOG_LEVEL env var
  # file: logs/app.log  # Optional alternative to LOG_FILE env var
```

### `main.py` changes
```python
from src.util.logging import setup_logging
from src.middleware.logging import RequestLoggingMiddleware

setup_logging()
app.add_middleware(RequestLoggingMiddleware)
```

---

## Priority Order

1. **Create `src/util/logging.py`** — foundation for everything else
2. **Update `main.py`** — enable logging at startup
3. **Add request logging middleware** — immediate visibility into all requests
4. **Replace `print()` in `configs.py`** — fix silent error
5. **Add auth event logging** — security-critical operations
6. **Add error logging in routes** — catch and log failures
7. **Add database error logging** — visibility into data layer issues
8. **Add encryption error logging** — security operations visibility

---

## Quick Wins (Minimal Effort)
1. Add `logging.basicConfig(level=logging.INFO)` to `main.py`
2. Replace the `print("config not found")` in `configs.py:83` with `logging.error("Unknown SQL driver configured")`
3. Add basic request logging middleware

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Correct Approach |
|--------------|--------------|------------------|
| `print()` for logging | No levels, no timestamps, can't filter | Use `logger.info()` |
| `logger.info(f"User {user_id}")` | String always formatted, even if disabled | `logger.info("User %s", user_id)` |
| Logging PII/credentials | Security breach, compliance violation | Log user `sub` only, never raw data |
| Catching and silently ignoring | Hides bugs, makes debugging impossible | `except Exception: logger.exception("...")` |
| Logging in tight loops | Performance, log flooding | Use `DEBUG` level, sample, or skip |
| No correlation ID | Can't trace requests across logs | Add request ID middleware |

---

## Advanced Features

### Correlation ID (Request Tracing)
Add a unique ID to each request for tracing across log entries:

```python
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def get_request_id() -> str:
    return request_id_var.get()
```

Middleware sets the ID:
```python
request_id = str(uuid.uuid4())[:8]
request_id_var.set(request_id)
# Include in log format: %(request_id)s
```

### JSON Structured Logging (Production)
For production deployments with log aggregators (Datadog, Splunk, ELK):

```python
import json
import logging


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": get_request_id(),
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)
```

### Exception Logging
Always use `logger.exception()` or `logger.error(exc_info=True)` for exceptions:

```python
try:
    result = db.execute(query)
except Exception as e:
    logger.exception("Database query failed")  # Includes traceback
    # or
    logger.error("Database query failed", exc_info=True)
```

### Health Check Filtering
Health check endpoints (`/health`, `/`) are noisy. Filter them out:

```python
# In middleware
if request.url.path in ("/health", "/", "/openapi.json"):
    return await call_next(request)  # Skip logging

# Or log at DEBUG level
if request.url.path in ("/health",):
    logger.debug("%s %s -> %s", ...)
else:
    logger.info("%s %s -> %s", ...)
```

### Third-Party Library Logging
Configure noisy third-party loggers:

```python
# In setup_logging()
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # Suppress per-request logs
logging.getLogger("uvicorn.error").setLevel(logging.INFO)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)  # If using SQLAlchemy later
```

### Performance Considerations
- **Lazy evaluation**: Use `logger.debug("Result: %s", expensive_function())` — the function only runs if DEBUG is enabled
- **Async logging**: For high-traffic, use `logging.handlers.QueueHandler` to avoid blocking
- **String formatting**: Use `%s` style, not f-strings: `logger.info("User %s", user_id)` not `logger.info(f"User {user_id}")`

### Graceful Degradation
If logging fails, the app should not crash:

```python
try:
    setup_logging()
except Exception:
    # Fall back to basic logging
    logging.basicConfig(level=logging.INFO)
```

---

## Monitoring & Alerting

### Key Metrics to Extract from Logs
- **Error rate**: Count of `ERROR` and `CRITICAL` logs per minute
- **Response time**: Average/p95/p99 from request logging middleware
- **Auth failures**: Failed login attempts (potential brute force)
- **Database errors**: Connection failures, query timeouts

### Alert Thresholds (Suggested)
- `CRITICAL` logs → Immediate alert
- `ERROR` rate > 10/min → Warning alert
- Response time p95 > 2s → Performance alert
- Auth failures > 5/min from same IP → Security alert

---

## Practical Examples

### Adding Logging to a Route Handler

```python
# src/routes/facility_routes.py
import logging
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)


class FacilityRoutes:
    def __init__(self):
        self.router = APIRouter(prefix="/facilities", tags=["facilities"])
        # ... route definitions ...

    async def get_facility(self, facility_id: str):
        logger.debug("Fetching facility %s", facility_id)
        try:
            facility = self.db.get(facility_id)
            if facility is None:
                logger.warning("Facility not found: %s", facility_id)
                raise HTTPException(status_code=404, detail="Facility not found")
            logger.info("Facility retrieved: %s", facility_id)
            return facility
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed to fetch facility %s", facility_id)
            raise HTTPException(status_code=500, detail="Internal server error")
```

### Request/Response Body Logging

**Security note**: Never log PII, tokens, or credentials in request/response bodies.

```python
# Safe to log: non-sensitive fields only
logger.debug("Request body: %s", {"event_type": body.event_type, "venue_id": body.venue_id})

# Never log: names, emails, tokens, passwords
# logger.debug("Request body: %s", body)  # BAD - may contain PII
```

### Standardized Log Field Names

Use consistent field names across all log messages for easier filtering/searching:

| Field | Description | Example |
|-------|-------------|---------|
| `user_sub` | User identifier (Google sub) | `user_sub=111122296393493391055` |
| `facility_id` | Facility identifier | `facility_id=abc123` |
| `event_id` | Event identifier | `event_id=evt456` |
| `duration` | Request duration in seconds | `duration=0.234` |
| `status_code` | HTTP status code | `status_code=200` |
| `error_type` | Exception class name | `error_type=ValueError` |

---

## Testing Logging

### Manual Testing
```bash
# Start server with debug logging
LOG_LEVEL=DEBUG uvicorn main:app --reload

# Check logs appear
# Trigger a request and verify log output
curl http://localhost:8000/facilities

# Test error logging - send invalid data
curl -X POST http://localhost:8000/facilities -d '{"invalid": "data"}'
```

### Test Cases
- Verify logs appear in stdout when running `uvicorn main:app --reload`
- Test error logging by triggering a validation error
- Test auth logging by attempting login
- Test correlation ID appears in all log entries for a single request
- Check that no sensitive data (keys, tokens, PII) appears in logs
- Verify health check endpoints don't flood logs
- Test log level changes via `LOG_LEVEL` environment variable
- Test file logging by setting `LOG_FILE` environment variable
- Verify log rotation works (create >5MB of logs)
- Verify `logger.exception()` includes full traceback in logs
