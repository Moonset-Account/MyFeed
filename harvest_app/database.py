from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def get_database_path() -> Path:
    """Return the SQLite path, allowing tests and local setups to override it."""
    return Path(os.environ.get("HARVEST_DB_PATH", str(BASE_DIR / "harvest.db")))


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY,
    parcel TEXT NOT NULL CHECK(trim(parcel) <> ''),
    variety TEXT NOT NULL CHECK(trim(variety) <> ''),
    harvest_date TEXT NOT NULL,
    weight_g INTEGER NOT NULL CHECK(weight_g > 0),
    packed_weight_g INTEGER NOT NULL
        CHECK(packed_weight_g >= 0 AND packed_weight_g <= weight_g),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boxes (
    code TEXT PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    weight_g INTEGER NOT NULL CHECK(weight_g > 0),
    FOREIGN KEY(batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_boxes_batch_id ON boxes(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_harvest_date ON batches(harvest_date);
"""


def init_db(database_path: Path | None = None) -> None:
    path = database_path or get_database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.executescript(SCHEMA_SQL)


def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(get_database_path(), timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    try:
        yield connection
    finally:
        connection.close()
