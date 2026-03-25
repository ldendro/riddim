"""
Riddim — SQLite Database Helpers

Provides connection management and initialization utilities.
"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from backend.config import DB_PATH

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    """Create a new SQLite connection with recommended settings."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager for database connections with auto-commit/rollback."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database by running schema.sql."""
    schema_sql = SCHEMA_PATH.read_text()
    with get_db() as conn:
        conn.executescript(schema_sql)
    print(f"Database initialized at {DB_PATH}")


def query_all(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a query and return all rows as dicts."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    """Execute a query and return a single row as a dict."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None


def execute(sql: str, params: tuple = ()) -> int:
    """Execute an INSERT/UPDATE/DELETE and return lastrowid."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        return cursor.lastrowid


def executemany(sql: str, params_list: list[tuple]) -> None:
    """Execute a batch INSERT/UPDATE/DELETE."""
    with get_db() as conn:
        conn.executemany(sql, params_list)
