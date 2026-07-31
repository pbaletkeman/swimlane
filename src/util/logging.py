"""Centralized logging configuration for the Swimlane application.

Provides a single setup_logging() function that configures Python's logging
module with sensible defaults. Supports environment-variable overrides and
optional file-based log rotation for non-containerized deployments.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

TEXT_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


class JSONFormatter(logging.Formatter):
    """JSON log formatter for production log aggregators."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data, default=str)


def setup_logging() -> None:
    """Configure the root logger for the application.

    Environment variables
    ---------------------
    LOG_LEVEL : str
        Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        Defaults to INFO.
    LOG_FORMAT : str
        ``text`` for human-readable output (default), ``json`` for structured
        JSON lines suitable for log aggregators.
    LOG_FILE : str, optional
        If set, a ``RotatingFileHandler`` writes to this path in addition to
        stdout.  Directories are created automatically.
    """
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    use_json = os.environ.get("LOG_FORMAT", "text").lower() == "json"
    formatter: logging.Formatter = JSONFormatter() if use_json else logging.Formatter(TEXT_FORMAT)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    handlers: list[logging.Handler] = [stream_handler]

    log_file = os.environ.get("LOG_FILE")
    if log_file:
        os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
        file_handler = RotatingFileHandler(log_file, maxBytes=5_000_000, backupCount=5)
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)

    logging.basicConfig(
        level=level,
        handlers=handlers,
        force=True,
    )

    # Tone down noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
