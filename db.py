from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "appointments.db"

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS windows (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE,
    service_name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 240),
    open_time TEXT NOT NULL,
    close_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY,
    window_id INTEGER NOT NULL,
    resident_code TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    daily_sequence INTEGER NOT NULL,
    queue_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked'
        CHECK (status IN ('booked', 'attended', 'late', 'no_show', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (window_id) REFERENCES windows (id),
    UNIQUE (date, daily_sequence),
    UNIQUE (date, queue_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_slot
ON appointments (window_id, date, start_time)
WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_appointments_lookup
ON appointments (resident_code, date, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_day
ON appointments (date, window_id, start_time);
"""


def get_db_path() -> Path:
    return Path(os.environ.get("APPOINTMENT_DB_PATH", DEFAULT_DB_PATH))


def connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path is not None else get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    return conn


def init_db(db_path: str | Path | None = None) -> None:
    conn = connect(db_path)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


@contextmanager
def db_session(db_path: str | Path | None = None) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
