"""采收追溯表：FastAPI + 原生 JavaScript + 本地 SQLite。

功能：
- 登记采收批次（地块、品种、采收日期、重量）
- 登记分装箱号（同一箱号只能归属一个批次；分装总重不能超过采收量）
- 按箱号查询来源批次与剩余库存
- CSV 导出全部分装记录
"""

from __future__ import annotations

import csv
import io
import os
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

SCHEMA = """
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot TEXT NOT NULL,
    variety TEXT NOT NULL,
    harvest_date TEXT NOT NULL,
    weight_kg REAL NOT NULL CHECK (weight_kg > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS boxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_no TEXT NOT NULL UNIQUE,
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    weight_kg REAL NOT NULL CHECK (weight_kg > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
"""


class BatchIn(BaseModel):
    plot: str = Field(min_length=1, max_length=100)
    variety: str = Field(min_length=1, max_length=100)
    harvest_date: date
    weight_kg: float = Field(gt=0)

    @field_validator("plot", "variety")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("不能为空")
        return v


class BoxIn(BaseModel):
    box_no: str = Field(min_length=1, max_length=50)
    weight_kg: float = Field(gt=0)

    @field_validator("box_no")
    @classmethod
    def strip_box_no(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("箱号不能为空")
        return v


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _batch_remaining(conn: sqlite3.Connection, batch_id: int) -> dict:
    batch = conn.execute(
        "SELECT * FROM batches WHERE id = ?", (batch_id,)
    ).fetchone()
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    packed = conn.execute(
        "SELECT COALESCE(SUM(weight_kg), 0) AS s FROM boxes WHERE batch_id = ?",
        (batch_id,),
    ).fetchone()["s"]
    row = dict(batch)
    row["packed_kg"] = round(packed, 3)
    row["remaining_kg"] = round(batch["weight_kg"] - packed, 3)
    return row


def create_app(db_path: str) -> FastAPI:
    app = FastAPI(title="采收追溯表")

    with closing(_connect(db_path)) as conn:
        conn.executescript(SCHEMA)
        conn.commit()

    def db() -> sqlite3.Connection:
        return _connect(db_path)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @app.post("/api/batches", status_code=201)
    def create_batch(payload: BatchIn) -> dict:
        with closing(db()) as conn:
            cur = conn.execute(
                "INSERT INTO batches (plot, variety, harvest_date, weight_kg)"
                " VALUES (?, ?, ?, ?)",
                (
                    payload.plot,
                    payload.variety,
                    payload.harvest_date.isoformat(),
                    payload.weight_kg,
                ),
            )
            conn.commit()
            return _batch_remaining(conn, cur.lastrowid)

    @app.get("/api/batches")
    def list_batches() -> list[dict]:
        with closing(db()) as conn:
            rows = conn.execute(
                """
                SELECT b.*, COALESCE(SUM(x.weight_kg), 0) AS packed_kg
                FROM batches b
                LEFT JOIN boxes x ON x.batch_id = b.id
                GROUP BY b.id
                ORDER BY b.id DESC
                """
            ).fetchall()
            result = []
            for r in rows:
                item = dict(r)
                item["packed_kg"] = round(item["packed_kg"], 3)
                item["remaining_kg"] = round(item["weight_kg"] - item["packed_kg"], 3)
                result.append(item)
            return result

    @app.post("/api/batches/{batch_id}/boxes", status_code=201)
    def create_box(batch_id: int, payload: BoxIn) -> dict:
        with closing(db()) as conn:
            # IMMEDIATE 事务保证“校验 + 写入”原子，避免并发下超装
            conn.execute("BEGIN IMMEDIATE")
            try:
                batch = _batch_remaining(conn, batch_id)
                if payload.weight_kg > batch["remaining_kg"] + 1e-9:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"分装总重将超过采收量：批次剩余 "
                            f"{batch['remaining_kg']} kg，本次装箱 "
                            f"{payload.weight_kg} kg"
                        ),
                    )
                try:
                    cur = conn.execute(
                        "INSERT INTO boxes (box_no, batch_id, weight_kg)"
                        " VALUES (?, ?, ?)",
                        (payload.box_no, batch_id, payload.weight_kg),
                    )
                except sqlite3.IntegrityError:
                    raise HTTPException(
                        status_code=409,
                        detail=f"箱号 {payload.box_no} 已存在，不能归属两个批次",
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            row = conn.execute(
                "SELECT * FROM boxes WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
            return dict(row)

    @app.get("/api/boxes/{box_no}")
    def trace_box(box_no: str) -> dict:
        with closing(db()) as conn:
            box = conn.execute(
                "SELECT * FROM boxes WHERE box_no = ?", (box_no.strip(),)
            ).fetchone()
            if box is None:
                raise HTTPException(status_code=404, detail=f"未找到箱号 {box_no}")
            batch = _batch_remaining(conn, box["batch_id"])
            return {
                "box_no": box["box_no"],
                "box_weight_kg": box["weight_kg"],
                "batch": batch,
                "remaining_kg": batch["remaining_kg"],
            }

    @app.get("/api/export.csv")
    def export_csv() -> Response:
        with closing(db()) as conn:
            rows = conn.execute(
                """
                SELECT x.box_no, x.weight_kg AS box_weight_kg,
                       b.id AS batch_id, b.plot, b.variety,
                       b.harvest_date, b.weight_kg AS batch_weight_kg
                FROM boxes x
                JOIN batches b ON b.id = x.batch_id
                ORDER BY b.id, x.id
                """
            ).fetchall()
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["箱号", "箱重(kg)", "批次号", "地块", "品种", "采收日期", "批次采收量(kg)"]
        )
        for r in rows:
            writer.writerow(
                [
                    r["box_no"],
                    r["box_weight_kg"],
                    r["batch_id"],
                    r["plot"],
                    r["variety"],
                    r["harvest_date"],
                    r["batch_weight_kg"],
                ]
            )
        # utf-8-sig 让 Excel 直接打开中文不乱码
        return Response(
            content=buf.getvalue().encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=harvest_trace.csv"},
        )

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app


app = create_app(os.environ.get("HARVEST_DB", str(BASE_DIR / "harvest.db")))
