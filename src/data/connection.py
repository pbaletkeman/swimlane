"""Shared SQLite connection helpers for the data layer."""

import sqlite3


class ClosingConnection(sqlite3.Connection):
    """A Connection whose context-manager exit also closes it.

    ``sqlite3.Connection.__exit__`` commits/rolls back but leaves the handle
    open, relying on GC to release it (surfacing ResourceWarnings in tests).
    This subclass keeps the familiar ``with self._connect() as conn:`` pattern
    while guaranteeing the connection is closed when the block ends.
    """

    def __exit__(self, exc_type, exc_value, traceback):  # type: ignore[override]
        try:
            super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()
        return False
