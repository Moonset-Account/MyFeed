from __future__ import annotations

import sqlite3
from datetime import date as date_cls
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Literal
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from db import db_session, init_db

BASE_DIR = Path(__file__).resolve().parent
DisplayStatus = Literal["booked", "attended", "late", "no_show"]
STATUS_LABELS = {
    "booked": "已预约",
    "attended": "已到场",
    "late": "迟到",
    "no_show": "爽约",
    "cancelled": "已取消",
}


class WindowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    service_name: str = Field(min_length=1, max_length=60)
    duration_minutes: int = Field(ge=5, le=240)
    open_time: str
    close_time: str

    @field_validator("name", "service_name")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if not value:
            raise ValueError("不能为空")
        return value

    @field_validator("open_time", "close_time")
    @classmethod
    def valid_clock(cls, value: str) -> str:
        try:
            parsed = datetime.strptime(value, "%H:%M").time()
        except ValueError as exc:
            raise ValueError("时间格式必须为 HH:MM") from exc
        return parsed.strftime("%H:%M")


class WindowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    service_name: str | None = Field(default=None, min_length=1, max_length=60)
    duration_minutes: int | None = Field(default=None, ge=5, le=240)
    open_time: str | None = None
    close_time: str | None = None
    is_active: bool | None = None

    @field_validator("name", "service_name")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = " ".join(value.strip().split())
        if not value:
            raise ValueError("不能为空")
        return value

    @field_validator("open_time", "close_time")
    @classmethod
    def valid_optional_clock(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            parsed = datetime.strptime(value, "%H:%M").time()
        except ValueError as exc:
            raise ValueError("时间格式必须为 HH:MM") from exc
        return parsed.strftime("%H:%M")


class AppointmentCreate(BaseModel):
    window_id: int
    resident_code: str = Field(min_length=2, max_length=24)
    date: str
    start_time: str

    @field_validator("resident_code")
    @classmethod
    def clean_resident_code(cls, value: str) -> str:
        value = "".join(value.strip().split()).upper()
        if not value:
            raise ValueError("匿名编号不能为空")
        return value

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        try:
            return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
        except ValueError as exc:
            raise ValueError("日期格式必须为 YYYY-MM-DD") from exc

    @field_validator("start_time")
    @classmethod
    def valid_clock(cls, value: str) -> str:
        try:
            return datetime.strptime(value, "%H:%M").time().strftime("%H:%M")
        except ValueError as exc:
            raise ValueError("开始时间格式必须为 HH:MM") from exc


class AppointmentReschedule(BaseModel):
    window_id: int
    date: str
    start_time: str

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        try:
            return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
        except ValueError as exc:
            raise ValueError("日期格式必须为 YYYY-MM-DD") from exc

    @field_validator("start_time")
    @classmethod
    def valid_clock(cls, value: str) -> str:
        try:
            return datetime.strptime(value, "%H:%M").time().strftime("%H:%M")
        except ValueError as exc:
            raise ValueError("开始时间格式必须为 HH:MM") from exc


class AppointmentStatusUpdate(BaseModel):
    status: DisplayStatus


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="社区服务预约台", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


def get_db() -> sqlite3.Connection:
    with db_session() as conn:
        yield conn


def not_found(message: str = "记录不存在") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def conflict(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def parse_clock(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def parse_day(value: str) -> date_cls:
    return datetime.strptime(value, "%Y-%m-%d").date()


def add_minutes(clock: str, minutes: int) -> str:
    parsed = datetime.strptime(clock, "%H:%M")
    return (parsed + timedelta(minutes=minutes)).strftime("%H:%M")


def validate_window_hours(open_time: str, close_time: str, duration: int) -> None:
    start = parse_clock(open_time)
    end = parse_clock(close_time)
    if end <= start:
        raise HTTPException(status_code=422, detail="每日结束时间必须晚于开始时间")
    open_minutes = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
    if open_minutes < duration:
        raise HTTPException(status_code=422, detail="每日开放时长不能短于单次服务时长")
    if open_minutes % duration != 0:
        raise HTTPException(status_code=422, detail="每日开放时段必须能被单次服务时长整除")


def slot_times(open_time: str, close_time: str, duration: int) -> list[str]:
    current = parse_clock(open_time)
    end = parse_clock(close_time)
    values: list[str] = []
    while current < end:
        values.append(current.strftime("%H:%M"))
        current = (datetime.combine(date_cls.today(), current) + timedelta(minutes=duration)).time()
    return values


def serialize_window(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "service_name": row["service_name"],
        "duration_minutes": row["duration_minutes"],
        "open_time": row["open_time"],
        "close_time": row["close_time"],
        "is_active": bool(row["is_active"]),
        "slots": slot_times(row["open_time"], row["close_time"], row["duration_minutes"]),
    }


def fetch_window(conn: sqlite3.Connection, window_id: int, active_only: bool = True) -> sqlite3.Row:
    sql = "SELECT * FROM windows WHERE id = ?"
    params: list[object] = [window_id]
    if active_only:
        sql += " AND is_active = 1"
    row = conn.execute(sql, params).fetchone()
    if row is None:
        raise not_found("服务窗口不存在")
    return row


def ensure_slot_matches_window(window: sqlite3.Row, day: str, start_time: str) -> str:
    if day < date_cls.today().isoformat():
        raise HTTPException(status_code=422, detail="不能预约过去的日期")
    allowed = set(slot_times(window["open_time"], window["close_time"], window["duration_minutes"]))
    if start_time not in allowed:
        raise HTTPException(status_code=422, detail="该时间不在窗口的可预约时段内")
    return add_minutes(start_time, window["duration_minutes"])


def serialize_appointment(row: sqlite3.Row, include_resident: bool = False) -> dict:
    result = {
        "id": row["id"],
        "window_id": row["window_id"],
        "window_name": row["window_name"],
        "service_name": row["service_name"],
        "date": row["date"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "queue_number": row["queue_number"],
        "status": row["status"],
        "status_label": STATUS_LABELS[row["status"]],
        "duration_minutes": row["duration_minutes"],
    }
    if include_resident:
        result["resident_code"] = row["resident_code"]
    return result


@app.exception_handler(sqlite3.IntegrityError)
def handle_integrity_error(request: Request, exc: sqlite3.IntegrityError) -> JSONResponse:
    message = str(exc).lower()
    if "appointments.window_id" in message and "appointments.date" in message and "appointments.start_time" in message:
        detail = "该窗口此时段已被预约，请选择其他空档"
    elif "windows.name" in message:
        detail = "窗口名称已存在"
    else:
        detail = "数据冲突，操作未完成"
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": detail})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.post("/api/windows", status_code=201)
def create_window(payload: WindowCreate, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    validate_window_hours(payload.open_time, payload.close_time, payload.duration_minutes)
    cursor = conn.execute(
        """
        INSERT INTO windows (name, service_name, duration_minutes, open_time, close_time)
        VALUES (?, ?, ?, ?, ?)
        """,
        (payload.name, payload.service_name, payload.duration_minutes, payload.open_time, payload.close_time),
    )
    row = fetch_window(conn, cursor.lastrowid, active_only=False)
    return serialize_window(row)


@app.get("/api/windows")
def list_windows(
    include_inactive: bool = Query(False),
    conn: sqlite3.Connection = Depends(get_db),
) -> list[dict]:
    sql = "SELECT * FROM windows"
    if not include_inactive:
        sql += " WHERE is_active = 1"
    sql += " ORDER BY name, id"
    return [serialize_window(row) for row in conn.execute(sql).fetchall()]


@app.patch("/api/windows/{window_id}")
def update_window(
    window_id: int,
    payload: WindowUpdate,
    conn: sqlite3.Connection = Depends(get_db),
) -> dict:
    row = fetch_window(conn, window_id, active_only=False)
    data = payload.model_dump(exclude_unset=True)
    name = data.get("name", row["name"])
    service_name = data.get("service_name", row["service_name"])
    duration = data.get("duration_minutes", row["duration_minutes"])
    open_time = data.get("open_time", row["open_time"])
    close_time = data.get("close_time", row["close_time"])
    is_active = 1 if data.get("is_active", bool(row["is_active"])) else 0
    validate_window_hours(open_time, close_time, duration)
    conn.execute(
        """
        UPDATE windows
        SET name = ?, service_name = ?, duration_minutes = ?, open_time = ?,
            close_time = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (name, service_name, duration, open_time, close_time, is_active, window_id),
    )
    return serialize_window(fetch_window(conn, window_id, active_only=False))


@app.delete("/api/windows/{window_id}")
def delete_window(window_id: int, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    fetch_window(conn, window_id, active_only=False)
    has_appointments = conn.execute(
        "SELECT EXISTS(SELECT 1 FROM appointments WHERE window_id = ?) AS found",
        (window_id,),
    ).fetchone()["found"]
    if has_appointments:
        conn.execute(
            "UPDATE windows SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
            (window_id,),
        )
        return {"deleted": False, "deactivated": True, "detail": "窗口已有预约记录，已停用且保留历史"}
    conn.execute("DELETE FROM windows WHERE id = ?", (window_id,))
    return {"deleted": True, "deactivated": False}


def fetch_appointment_row(conn: sqlite3.Connection, appointment_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT a.*, w.name AS window_name, w.service_name, w.duration_minutes
        FROM appointments a
        JOIN windows w ON w.id = a.window_id
        WHERE a.id = ?
        """,
        (appointment_id,),
    ).fetchone()
    if row is None:
        raise not_found("预约不存在")
    return row


def make_booking(conn: sqlite3.Connection, window_id: int, resident_code: str, day: str, start: str) -> dict:
    conn.execute("BEGIN IMMEDIATE")
    window = fetch_window(conn, window_id)
    end_time = ensure_slot_matches_window(window, day, start)
    sequence = conn.execute(
        "SELECT COALESCE(MAX(daily_sequence), 0) + 1 AS next_value FROM appointments WHERE date = ?",
        (day,),
    ).fetchone()["next_value"]
    day_number = parse_day(day).strftime("%m%d")
    queue_number = f"H{day_number}-{sequence:03d}"
    cursor = conn.execute(
        """
        INSERT INTO appointments
            (window_id, resident_code, date, start_time, end_time, daily_sequence, queue_number)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (window_id, resident_code, day, start, end_time, sequence, queue_number),
    )
    return serialize_appointment(fetch_appointment_row(conn, cursor.lastrowid), include_resident=True)


@app.post("/api/appointments", status_code=201)
def create_appointment(payload: AppointmentCreate, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    return make_booking(conn, payload.window_id, payload.resident_code, payload.date, payload.start_time)


@app.post("/api/appointments/{appointment_id}/reschedule")
def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentReschedule,
    conn: sqlite3.Connection = Depends(get_db),
) -> dict:
    conn.execute("BEGIN IMMEDIATE")
    row = fetch_appointment_row(conn, appointment_id)
    if row["status"] == "cancelled":
        raise conflict("已取消的预约不能改期，请重新预约")
    if row["status"] in {"attended", "late", "no_show"}:
        raise conflict("已登记服务状态的预约不能改期")
    window = fetch_window(conn, payload.window_id)
    end_time = ensure_slot_matches_window(window, payload.date, payload.start_time)
    same_slot = (
        row["window_id"] == payload.window_id
        and row["date"] == payload.date
        and row["start_time"] == payload.start_time
    )
    if not same_slot:
        conn.execute(
            """
            UPDATE appointments
            SET window_id = ?, date = ?, start_time = ?, end_time = ?, updated_at = datetime('now')
            WHERE id = ? AND status = 'booked'
            """,
            (payload.window_id, payload.date, payload.start_time, end_time, appointment_id),
        )
    return serialize_appointment(fetch_appointment_row(conn, appointment_id), include_resident=True)

@app.post("/api/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: int, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    row = fetch_appointment_row(conn, appointment_id)
    if row["status"] == "cancelled":
        return serialize_appointment(row, include_resident=True)
    if row["status"] in {"attended", "late", "no_show"}:
        raise conflict("已登记服务状态的预约不能取消")
    conn.execute(
        """
        UPDATE appointments
        SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ?
        """,
        (appointment_id,),
    )
    return serialize_appointment(fetch_appointment_row(conn, appointment_id), include_resident=True)


@app.patch("/api/staff/appointments/{appointment_id}/status")
def set_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    conn: sqlite3.Connection = Depends(get_db),
) -> dict:
    row = fetch_appointment_row(conn, appointment_id)
    if row["status"] == "cancelled":
        raise conflict("已取消的预约不能登记到场状态")
    conn.execute(
        "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (payload.status, appointment_id),
    )
    return serialize_appointment(fetch_appointment_row(conn, appointment_id))


def validate_day(value: str) -> date_cls:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="日期格式必须为 YYYY-MM-DD") from exc


@app.get("/api/staff/day")
def staff_day(
    date: str = Query(default=""),
    conn: sqlite3.Connection = Depends(get_db),
) -> dict:
    day = date or date_cls.today().isoformat()
    validate_day(day)

    window_rows = conn.execute(
        """
        SELECT DISTINCT w.*
        FROM windows w
        LEFT JOIN appointments a ON a.window_id = w.id AND a.date = ?
        WHERE w.is_active = 1 OR a.id IS NOT NULL
        ORDER BY w.name, w.id
        """,
        (day,),
    ).fetchall()
    windows = [serialize_window(row) for row in window_rows]
    window_by_id = {row["id"]: row for row in window_rows}

    appointment_rows = conn.execute(
        """
        SELECT a.*, w.name AS window_name, w.service_name, w.duration_minutes
        FROM appointments a
        JOIN windows w ON w.id = a.window_id
        WHERE a.date = ? AND a.status != 'cancelled'
        ORDER BY a.start_time, w.name, a.daily_sequence
        """,
        (day,),
    ).fetchall()
    occupied: dict[int, set[str]] = {}
    queue = []
    counts: dict[str, int] = {key: 0 for key in ["booked", "attended", "late", "no_show"]}
    for row in appointment_rows:
        occupied.setdefault(row["window_id"], set()).add(row["start_time"])
        queue.append(serialize_appointment(row))
        counts[row["status"]] = counts.get(row["status"], 0) + 1

    gaps = []
    available_count = 0
    for item in windows:
        row = window_by_id[item["id"]]
        used = occupied.get(item["id"], set())
        for slot in item["slots"]:
            if slot not in used:
                available_count += 1
                gaps.append(
                    {
                        "window_id": item["id"],
                        "window_name": item["name"],
                        "service_name": item["service_name"],
                        "start_time": slot,
                        "end_time": add_minutes(slot, row["duration_minutes"]),
                    }
                )

    return {
        "date": day,
        "windows": windows,
        "queue": queue,
        "gaps": gaps,
        "status_counts": counts,
        "summary": {
            "window_count": len(windows),
            "appointment_count": len(queue),
            "available_slot_count": available_count,
        },
    }


@app.get("/api/appointments/mine")
def my_appointments(
    resident_code: str = Query(min_length=2, max_length=24),
    conn: sqlite3.Connection = Depends(get_db),
) -> list[dict]:
    code = "".join(resident_code.strip().split()).upper()
    if not code:
        raise HTTPException(status_code=422, detail="匿名编号不能为空")
    today = date_cls.today().isoformat()
    rows = conn.execute(
        """
        SELECT a.*, w.name AS window_name, w.service_name, w.duration_minutes
        FROM appointments a
        JOIN windows w ON w.id = a.window_id
        WHERE upper(a.resident_code) = ?
          AND a.date >= ?
          AND a.status != 'cancelled'
        ORDER BY a.date, a.start_time, w.name
        """,
        (code, today),
    ).fetchall()
    return [serialize_appointment(row, include_resident=True) for row in rows]
