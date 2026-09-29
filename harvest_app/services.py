from __future__ import annotations

import sqlite3
from decimal import Decimal

from harvest_app.schemas import BatchIn, BoxOut, BatchOut, BoxSourceOut

GRAMS_PER_KILOGRAM = Decimal("1000")


class BusinessError(Exception):
    """A request with valid syntax that violates a harvest business rule."""


class ConflictError(BusinessError):
    """A resource conflict, such as a box code already used by another batch."""


class NotFoundError(BusinessError):
    """The requested batch or box does not exist."""


def kg_to_grams(value: Decimal) -> int:
    return int(value * GRAMS_PER_KILOGRAM)


def format_kg(grams: int) -> str:
    value = Decimal(grams) / GRAMS_PER_KILOGRAM
    normalized = value.normalize()
    return format(normalized, "f")


def create_batch(connection: sqlite3.Connection, payload: BatchIn) -> BatchOut:
    weight_g = kg_to_grams(payload.weight_kg)
    box_rows = [(box.code, kg_to_grams(box.weight_kg)) for box in payload.boxes]
    packed_weight_g = sum(weight for _, weight in box_rows)

    if packed_weight_g > weight_g:
        raise BusinessError(
            f"分装总重 {format_kg(packed_weight_g)} kg 超过采收重量 "
            f"{format_kg(weight_g)} kg"
        )

    codes = [code for code, _ in box_rows]
    placeholders = ",".join("?" for _ in codes)
    connection.execute("BEGIN IMMEDIATE")
    try:
        existing_rows = connection.execute(
            f"SELECT code FROM boxes WHERE code IN ({placeholders}) ORDER BY code",
            codes,
        ).fetchall()
        if existing_rows:
            existing_codes = "、".join(row["code"] for row in existing_rows)
            raise ConflictError(f"箱号已归属其他批次：{existing_codes}")

        cursor = connection.execute(
            """
            INSERT INTO batches
                (parcel, variety, harvest_date, weight_g, packed_weight_g)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload.parcel,
                payload.variety,
                payload.harvest_date.isoformat(),
                weight_g,
                packed_weight_g,
            ),
        )
        batch_id = int(cursor.lastrowid)
        connection.executemany(
            """
            INSERT INTO boxes (code, batch_id, weight_g)
            VALUES (?, ?, ?)
            """,
            [(code, batch_id, weight) for code, weight in box_rows],
        )
        connection.commit()
    except ConflictError:
        connection.rollback()
        raise
    except sqlite3.IntegrityError as exc:
        connection.rollback()
        raise ConflictError("箱号不能同时归属两个批次") from exc
    except Exception:
        connection.rollback()
        raise

    return get_batch(connection, batch_id)


def _batch_from_row(connection: sqlite3.Connection, row: sqlite3.Row) -> BatchOut:
    box_rows = connection.execute(
        """
        SELECT code, weight_g
        FROM boxes
        WHERE batch_id = ?
        ORDER BY code
        """,
        (row["id"],),
    ).fetchall()
    packed_weight_g = row["packed_weight_g"]
    remaining_g = row["weight_g"] - packed_weight_g
    return BatchOut(
        id=row["id"],
        parcel=row["parcel"],
        variety=row["variety"],
        harvest_date=row["harvest_date"],
        weight_kg=format_kg(row["weight_g"]),
        packed_weight_kg=format_kg(packed_weight_g),
        remaining_kg=format_kg(remaining_g),
        boxes=[
            BoxOut(code=box["code"], weight_kg=format_kg(box["weight_g"]))
            for box in box_rows
        ],
    )


def get_batch(connection: sqlite3.Connection, batch_id: int) -> BatchOut:
    row = connection.execute(
        "SELECT * FROM batches WHERE id = ?",
        (batch_id,),
    ).fetchone()
    if row is None:
        raise NotFoundError("批次不存在")
    return _batch_from_row(connection, row)


def list_batches(connection: sqlite3.Connection) -> list[BatchOut]:
    rows = connection.execute(
        """
        SELECT *
        FROM batches
        ORDER BY harvest_date DESC, id DESC
        """
    ).fetchall()
    return [_batch_from_row(connection, row) for row in rows]


def find_box(connection: sqlite3.Connection, code: str) -> BoxSourceOut:
    row = connection.execute(
        """
        SELECT
            boxes.code AS code,
            boxes.weight_g AS box_weight_g,
            batches.id AS batch_id,
            batches.parcel AS parcel,
            batches.variety AS variety,
            batches.harvest_date AS harvest_date,
            batches.weight_g AS batch_weight_g,
            batches.packed_weight_g AS packed_weight_g
        FROM boxes
        INNER JOIN batches ON batches.id = boxes.batch_id
        WHERE boxes.code = ?
        """,
        (code.strip(),),
    ).fetchone()
    if row is None:
        raise NotFoundError("未找到该箱号")

    remaining_g = row["batch_weight_g"] - row["packed_weight_g"]
    return BoxSourceOut(
        code=row["code"],
        weight_kg=format_kg(row["box_weight_g"]),
        remaining_kg=format_kg(remaining_g),
        batch_id=row["batch_id"],
        parcel=row["parcel"],
        variety=row["variety"],
        harvest_date=row["harvest_date"],
        batch_weight_kg=format_kg(row["batch_weight_g"]),
        packed_weight_kg=format_kg(row["packed_weight_g"]),
    )
