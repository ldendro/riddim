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
    """Initialize the database by running schema.sql and applying migrations."""
    schema_sql = SCHEMA_PATH.read_text()
    with get_db() as conn:
        conn.executescript(schema_sql)
        _run_migrations(conn)
    print(f"Database initialized at {DB_PATH}")


def _run_migrations(conn):
    """Apply schema migrations for existing databases."""
    # Check if users table needs auth columns
    cursor = conn.execute("PRAGMA table_info(users)")
    columns = {row[1] for row in cursor.fetchall()}

    if "email" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    if "password_hash" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "display_name" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
    if "onboarding_complete" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0")

    # Check if features table needs drop_timestamps column
    cursor = conn.execute("PRAGMA table_info(features)")
    feat_columns = {row[1] for row in cursor.fetchall()}
    if "drop_timestamps" not in feat_columns:
        conn.execute("ALTER TABLE features ADD COLUMN drop_timestamps JSON")

    # Create saved_prompts table for DJ Byte generation prompts
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_item
        ON saved_prompts(user_id, item_id)
    """)

    # Add in_library column to reactions table
    cursor = conn.execute("PRAGMA table_info(reactions)")
    react_columns = {row[1] for row in cursor.fetchall()}
    if "in_library" not in react_columns:
        conn.execute("ALTER TABLE reactions ADD COLUMN in_library INTEGER DEFAULT 0")
        # Set in_library = 1 for existing love/like reactions
        conn.execute("""
            UPDATE reactions SET in_library = 1
            WHERE reaction IN ('love', 'like')
        """)

    # Create unique index on (user_id, item_id) if it doesn't exist
    # This enforces one authoritative reaction per user per track
    try:
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_item
            ON reactions(user_id, item_id)
        """)
    except Exception:
        # If duplicates exist, deduplicate: keep only the most recent reaction per user+item
        conn.execute("""
            DELETE FROM reactions
            WHERE id NOT IN (
                SELECT MAX(id) FROM reactions GROUP BY user_id, item_id
            )
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_item
            ON reactions(user_id, item_id)
        """)


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
