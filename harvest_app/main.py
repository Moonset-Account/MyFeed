from __future__ import annotations

import csv
import io
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Query, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from harvest_app.database import get_connection, init_db
from harvest_app.schemas import BatchIn, BatchOut, BoxSourceOut
from harvest_app.services import (
    BusinessError,
    ConflictError,
    NotFoundError,
    create_batch,
    find_box,
    format_kg,
    list_batches,
)

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(_application: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="采收追溯表", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.exception_handler(BusinessError)
def handle_business_rule(_request: Request, exc: BusinessError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
def handle_conflict(_request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(NotFoundError)
def handle_not_found(_request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


Connection = Annotated[sqlite3.Connection, Depends(get_connection)]


@app.post("/api/batches", response_model=BatchOut, status_code=201)
def register_batch(payload: BatchIn, connection: Connection) -> BatchOut:
    return create_batch(connection, payload)


@app.get("/api/batches", response_model=list[BatchOut])
def get_batches(connection: Connection) -> list[BatchOut]:
    return list_batches(connection)


@app.get("/api/boxes", response_model=BoxSourceOut)
def get_box_source(
    connection: Connection,
    code: Annotated[str, Query(min_length=1, max_length=64)],
) -> BoxSourceOut:
    return find_box(connection, code)


def _csv_cell(value: object) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("+", "-", "=", "@")):
        return "'" + text
    return text


@app.get("/api/export.csv")
def export_batches(
    connection: Connection,
    box_code: Annotated[str | None, Query(max_length=64)] = None,
) -> Response:
    sql = """
        SELECT
            batches.id AS batch_id,
            batches.parcel AS parcel,
            batches.variety AS variety,
            batches.harvest_date AS harvest_date,
            batches.weight_g AS weight_g,
            batches.packed_weight_g AS packed_weight_g,
            batches.weight_g - batches.packed_weight_g AS remaining_g,
            boxes.code AS box_code,
            boxes.weight_g AS box_weight_g
        FROM batches
        INNER JOIN boxes ON boxes.batch_id = batches.id
    """
    params: tuple[str, ...] = ()
    if box_code is not None and box_code.strip():
        sql += " WHERE boxes.code = ?\n"
        params = (box_code.strip(),)
    sql += " ORDER BY batches.harvest_date DESC, batches.id DESC, boxes.code"

    rows = connection.execute(sql, params).fetchall()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "批次ID",
            "地块",
            "品种",
            "采收日期",
            "采收重量kg",
            "已分装重量kg",
            "剩余库存kg",
            "箱号",
            "单箱重量kg",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                _csv_cell(row["batch_id"]),
                _csv_cell(row["parcel"]),
                _csv_cell(row["variety"]),
                _csv_cell(row["harvest_date"]),
                _csv_cell(format_kg(row["weight_g"])),
                _csv_cell(format_kg(row["packed_weight_g"])),
                _csv_cell(format_kg(row["remaining_g"])),
                _csv_cell(row["box_code"]),
                _csv_cell(format_kg(row["box_weight_g"])),
            ]
        )

    csv_bytes = b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="harvest-batches.csv"'},
    )
