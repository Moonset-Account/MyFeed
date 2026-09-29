"""FastAPI application for a local community-service appointment desk."""
from __future__ import annotations

import os
import random
import sqlite3
import string
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("APPOINTMENT_DB", BASE_DIR / "appointments.db"))

ACTIVE_STATUS = "booked"
TERMINAL_STATUSES = {"completed", "cancelled", "no_show"}
APPROVED_STATUSES = {"booked", "called", "late", "completed", "cancelled", "no_show"}


def get_db_path() -> Path:
    return Path(os.environ.get("APPOINTMENT_DB", BASE_DIR / "appointments.db"))


def connect_db(db_path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path or get_db_path()), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="社区服务预约台", version="1.0.0", lifespan=lifespan)


class WindowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    service_name: str = Field(min_length=1, max_length=80)
    duration_minutes: int = Field(ge=5, le=240)
    is_active: bool = True


class WindowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    service_name: str | None = Field(default=None, min_length=1, max_length=80)
    duration_minutes: int | None = Field(default=None, ge=5, le=240)
    is_active: bool | None = None


class ScheduleCreate(BaseModel):
    window_id: int
    schedule_date: date
    opens_at: time
    closes_at: time


class ScheduleUpdate(BaseModel):
    opens_at: time
    closes_at: time


class AppointmentCreate(BaseModel):
    window_id: int
    schedule_date: date
    starts_at: time
    resident_name: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=200)


class AppointmentReschedule(BaseModel):
    window_id: int
    schedule_date: date
    starts_at: time


class AppointmentStatusUpdate(BaseModel):
    status: Literal["booked", "called", "late", "completed", "cancelled", "no_show"]


def init_db(db_path: Path | None = None) -> None:
    target = db_path or get_db_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    with connect_db(target) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS service_windows (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                service_name TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 240),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_schedules (
                id INTEGER PRIMARY KEY,
                window_id INTEGER NOT NULL,
                schedule_date TEXT NOT NULL,
                opens_at TEXT NOT NULL,
                closes_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(window_id, schedule_date),
                FOREIGN KEY(window_id) REFERENCES service_windows(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY,
                reference TEXT NOT NULL UNIQUE,
                window_id INTEGER NOT NULL,
                schedule_date TEXT NOT NULL,
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'booked',
                resident_name TEXT,
                note TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CHECK(status IN ('booked', 'called', 'late', 'completed', 'cancelled', 'no_show'))
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_active_window_slot
                ON appointments(window_id, schedule_date, starts_at)
                WHERE status IN ('booked', 'called', 'late', 'completed', 'no_show');

            CREATE INDEX IF NOT EXISTS idx_appointments_day
                ON appointments(schedule_date, window_id, starts_at);
            """
        )


def get_conn() -> sqlite3.Connection:
    conn = connect_db()
    try:
        yield conn
    finally:
        conn.close()


DbDep = Depends(get_conn)


def http_error(status_code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def time_to_str(value: time) -> str:
    return value.strftime("%H:%M")


def parse_time(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def minute_count(open_value: time, close_value: time) -> int:
    opens = datetime.combine(date.min, open_value)
    closes = datetime.combine(date.min, close_value)
    return int((closes - opens).total_seconds() // 60)


def add_minutes(value: time, minutes: int) -> time:
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()


def window_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "service_name": row["service_name"],
        "duration_minutes": row["duration_minutes"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


def schedule_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "window_id": row["window_id"],
        "window_name": row["window_name"],
        "service_name": row["service_name"],
        "duration_minutes": row["duration_minutes"],
        "is_active": bool(row["is_active"]) if "is_active" in row.keys() else True,
        "schedule_date": row["schedule_date"],
        "opens_at": row["opens_at"],
        "closes_at": row["closes_at"],
    }


def appointment_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "reference": row["reference"],
        "window_id": row["window_id"],
        "window_name": row["window_name"],
        "service_name": row["service_name"],
        "schedule_date": row["schedule_date"],
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "status": row["status"],
        "resident_name": row["resident_name"],
        "note": row["note"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_window_or_404(conn: sqlite3.Connection, window_id: int, *, active_only: bool = False) -> sqlite3.Row:
    sql = "SELECT * FROM service_windows WHERE id = ?"
    if active_only:
        sql += " AND is_active = 1"
    row = conn.execute(sql, (window_id,)).fetchone()
    if row is None:
        raise http_error(status.HTTP_404_NOT_FOUND, "服务窗口不存在或已停用")
    return row


def get_schedule_or_404(
    conn: sqlite3.Connection,
    window_id: int,
    schedule_date: date,
    *,
    require_active_window: bool = False,
) -> sqlite3.Row:
    window = get_window_or_404(conn, window_id, active_only=require_active_window)
    row = conn.execute(
        """
        SELECT ds.*, sw.name AS window_name, sw.service_name, sw.duration_minutes
        FROM daily_schedules ds
        JOIN service_windows sw ON sw.id = ds.window_id
        WHERE ds.window_id = ? AND ds.schedule_date = ?
        """,
        (window_id, schedule_date.isoformat()),
    ).fetchone()
    if row is None:
        raise http_error(status.HTTP_404_NOT_FOUND, "该窗口当天没有开放时段")
    return row


def get_schedule_by_id_or_404(conn: sqlite3.Connection, schedule_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT ds.*, sw.name AS window_name, sw.service_name, sw.duration_minutes
        FROM daily_schedules ds
        JOIN service_windows sw ON sw.id = ds.window_id
        WHERE ds.id = ?
        """,
        (schedule_id,),
    ).fetchone()
    if row is None:
        raise http_error(status.HTTP_404_NOT_FOUND, "每日时段不存在")
    return row


def validate_schedule_window(opens_at: time, closes_at: time, duration_minutes: int) -> None:
    if closes_at <= opens_at:
        raise http_error(status.HTTP_400_BAD_REQUEST, "结束时间必须晚于开始时间")
    if minute_count(opens_at, closes_at) < duration_minutes:
        raise http_error(status.HTTP_400_BAD_REQUEST, "开放时段至少要能容纳一个服务时长")


def generate_reference(conn: sqlite3.Connection) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(20):
        candidate = "".join(random.SystemRandom().choice(alphabet) for _ in range(6))
        exists = conn.execute("SELECT 1 FROM appointments WHERE reference = ?", (candidate,)).fetchone()
        if not exists:
            return candidate
    raise http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "匿名编号暂时不足，请重试")


def validate_bookable_slot(schedule: sqlite3.Row, starts_at: time) -> tuple[time, time]:
    opens = parse_time(schedule["opens_at"])
    closes = parse_time(schedule["closes_at"])
    duration = int(schedule["duration_minutes"])
    ends_at = add_minutes(starts_at, duration)
    if starts_at < opens or ends_at > closes:
        raise http_error(status.HTTP_400_BAD_REQUEST, "预约时段超出当天开放时间")
    difference = minute_count(opens, starts_at)
    if difference % duration != 0:
        raise http_error(status.HTTP_400_BAD_REQUEST, f"预约必须从每 {duration} 分钟的固定时段开始")
    return starts_at, ends_at


def assert_slot_available(
    conn: sqlite3.Connection,
    window_id: int,
    schedule_date: date,
    starts_at: time,
    *,
    exclude_appointment_id: int | None = None,
) -> None:
    params: list[Any] = [window_id, schedule_date.isoformat(), time_to_str(starts_at)]
    sql = """
        SELECT reference FROM appointments
        WHERE window_id = ? AND schedule_date = ? AND starts_at = ?
          AND status IN ('booked', 'called', 'late', 'completed', 'no_show')
    """
    if exclude_appointment_id is not None:
        sql += " AND id != ?"
        params.append(exclude_appointment_id)
    row = conn.execute(sql, params).fetchone()
    if row:
        raise http_error(status.HTTP_409_CONFLICT, f"该时段已被预约，请选择其他空档（占用编号：{row['reference']}）")


def get_owned_appointment_or_404(conn: sqlite3.Connection, reference: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT a.*, sw.name AS window_name, sw.service_name
        FROM appointments a JOIN service_windows sw ON sw.id = a.window_id
        WHERE UPPER(a.reference) = UPPER(?)
        """,
        (reference.strip(),),
    ).fetchone()
    if row is None:
        raise http_error(status.HTTP_404_NOT_FOUND, "预约编号不存在")
    return row


def get_appointment_or_404(conn: sqlite3.Connection, appointment_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT a.*, sw.name AS window_name, sw.service_name
        FROM appointments a JOIN service_windows sw ON sw.id = a.window_id
        WHERE a.id = ?
        """,
        (appointment_id,),
    ).fetchone()
    if row is None:
        raise http_error(status.HTTP_404_NOT_FOUND, "预约不存在")
    return row


def build_slots(schedule: sqlite3.Row) -> list[dict[str, str]]:
    opens = parse_time(schedule["opens_at"])
    closes = parse_time(schedule["closes_at"])
    duration = int(schedule["duration_minutes"])
    slots: list[dict[str, str]] = []
    cursor = opens
    while add_minutes(cursor, duration) <= closes:
        slots.append({"starts_at": time_to_str(cursor), "ends_at": time_to_str(add_minutes(cursor, duration))})
        cursor = add_minutes(cursor, duration)
    return slots


def availability_payload(
    conn: sqlite3.Connection,
    window_id: int,
    schedule_date: date,
    *,
    require_active_window: bool = False,
) -> dict[str, Any]:
    schedule = get_schedule_or_404(
        conn,
        window_id,
        schedule_date,
        require_active_window=require_active_window,
    )
    occupied = {
        row["starts_at"]: row
        for row in conn.execute(
            """
            SELECT starts_at, ends_at, status, reference
            FROM appointments
            WHERE window_id = ? AND schedule_date = ?
              AND status IN ('booked', 'called', 'late', 'completed', 'no_show')
            """,
            (window_id, schedule_date.isoformat()),
        )
    }
    slots = []
    for slot in build_slots(schedule):
        item = dict(slot)
        row = occupied.get(slot["starts_at"])
        item["available"] = row is None
        item["status"] = None if row is None else row["status"]
        item["reference"] = None if row is None else row["reference"]
        slots.append(item)
    return {
        "window_id": window_id,
        "schedule_date": schedule_date.isoformat(),
        "duration_minutes": schedule["duration_minutes"],
        "opens_at": schedule["opens_at"],
        "closes_at": schedule["closes_at"],
        "slots": slots,
    }

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/windows")
def list_windows(conn: sqlite3.Connection = DbDep, include_inactive: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM service_windows"
    if not include_inactive:
        sql += " WHERE is_active = 1"
    sql += " ORDER BY is_active DESC, name ASC"
    return [window_dict(row) for row in conn.execute(sql)]


@app.post("/api/windows", status_code=status.HTTP_201_CREATED)
def create_window(payload: WindowCreate, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    try:
        cursor = conn.execute(
            "INSERT INTO service_windows(name, service_name, duration_minutes, is_active) VALUES (?, ?, ?, ?)",
            (payload.name.strip(), payload.service_name.strip(), payload.duration_minutes, int(payload.is_active)),
        )
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise http_error(status.HTTP_409_CONFLICT, "窗口名称已存在") from exc
    return window_dict(get_window_or_404(conn, cursor.lastrowid))


@app.patch("/api/windows/{window_id}")
def update_window(window_id: int, payload: WindowUpdate, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    existing = get_window_or_404(conn, window_id)
    updates: dict[str, Any] = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.service_name is not None:
        updates["service_name"] = payload.service_name.strip()
    if payload.duration_minutes is not None:
        active_schedules = conn.execute(
            """
            SELECT COUNT(1) AS count FROM appointments
            WHERE window_id = ? AND status IN ('booked', 'called', 'late', 'completed', 'no_show')
            """,
            (window_id,),
        ).fetchone()["count"]
        if active_schedules:
            raise http_error(status.HTTP_409_CONFLICT, "该窗口已有有效预约，不能修改服务时长")
        updates["duration_minutes"] = payload.duration_minutes
    if payload.is_active is not None:
        updates["is_active"] = int(payload.is_active)
    if not updates:
        return window_dict(existing)
    assignments = ", ".join(f"{key} = ?" for key in updates)
    params = [*updates.values(), window_id]
    try:
        conn.execute(f"UPDATE service_windows SET {assignments} WHERE id = ?", params)
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise http_error(status.HTTP_409_CONFLICT, "窗口名称已存在") from exc
    return window_dict(get_window_or_404(conn, window_id))


@app.get("/api/schedules")
def list_schedules(
    schedule_date: date | None = None,
    conn: sqlite3.Connection = DbDep,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    sql = """
        SELECT ds.*, sw.name AS window_name, sw.service_name, sw.duration_minutes, sw.is_active
        FROM daily_schedules ds
        JOIN service_windows sw ON sw.id = ds.window_id
    """
    clauses = []
    params: list[Any] = []
    if schedule_date is not None:
        clauses.append("ds.schedule_date = ?")
        params.append(schedule_date.isoformat())
    if not include_inactive:
        clauses.append("sw.is_active = 1")
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY ds.schedule_date ASC, ds.opens_at ASC, sw.name ASC"
    return [schedule_dict(row) for row in conn.execute(sql, params)]


@app.post("/api/schedules", status_code=status.HTTP_201_CREATED)
def create_schedule(payload: ScheduleCreate, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    window = get_window_or_404(conn, payload.window_id)
    validate_schedule_window(payload.opens_at, payload.closes_at, int(window["duration_minutes"]))
    try:
        cursor = conn.execute(
            """
            INSERT INTO daily_schedules(window_id, schedule_date, opens_at, closes_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                payload.window_id,
                payload.schedule_date.isoformat(),
                time_to_str(payload.opens_at),
                time_to_str(payload.closes_at),
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise http_error(status.HTTP_409_CONFLICT, "该窗口当天的时段已经存在") from exc
    return schedule_dict(get_schedule_by_id_or_404(conn, cursor.lastrowid))


@app.put("/api/schedules/{schedule_id}")
def update_schedule(schedule_id: int, payload: ScheduleUpdate, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    schedule = get_schedule_by_id_or_404(conn, schedule_id)
    validate_schedule_window(payload.opens_at, payload.closes_at, int(schedule["duration_minutes"]))
    active_rows = conn.execute(
        """
        SELECT starts_at, ends_at FROM appointments
        WHERE window_id = ? AND schedule_date = ?
          AND status IN ('booked', 'called', 'late', 'completed', 'no_show')
        ORDER BY starts_at
        """,
        (schedule["window_id"], schedule["schedule_date"]),
    ).fetchall()
    new_open = payload.opens_at
    new_close = payload.closes_at
    duration = int(schedule["duration_minutes"])
    for row in active_rows:
        starts_at = parse_time(row["starts_at"])
        ends_at = parse_time(row["ends_at"])
        if starts_at < new_open or ends_at > new_close:
            raise http_error(status.HTTP_409_CONFLICT, "新开放时间会覆盖已有预约，请先处理相关预约")
        if minute_count(new_open, starts_at) % duration != 0:
            raise http_error(status.HTTP_409_CONFLICT, "新开始时间与已有固定时段不对齐")
    conn.execute(
        "UPDATE daily_schedules SET opens_at = ?, closes_at = ? WHERE id = ?",
        (time_to_str(new_open), time_to_str(new_close), schedule_id),
    )
    conn.commit()
    return schedule_dict(get_schedule_by_id_or_404(conn, schedule_id))


@app.delete(
    "/api/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_schedule(schedule_id: int, conn: sqlite3.Connection = DbDep) -> Response:
    schedule = get_schedule_by_id_or_404(conn, schedule_id)
    active_count = conn.execute(
        """
        SELECT COUNT(1) AS count FROM appointments
        WHERE window_id = ? AND schedule_date = ?
          AND status IN ('booked', 'called', 'late', 'completed', 'no_show')
        """,
        (schedule["window_id"], schedule["schedule_date"]),
    ).fetchone()["count"]
    if active_count:
        raise http_error(status.HTTP_409_CONFLICT, "当天仍有有效预约，不能删除开放时段")
    conn.execute("DELETE FROM daily_schedules WHERE id = ?", (schedule_id,))
    conn.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/availability")
def availability(window_id: int, schedule_date: date, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    return availability_payload(conn, window_id, schedule_date, require_active_window=True)


@app.post("/api/appointments", status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    schedule = get_schedule_or_404(conn, payload.window_id, payload.schedule_date, require_active_window=True)
    starts_at, ends_at = validate_bookable_slot(schedule, payload.starts_at)
    conn.execute("BEGIN IMMEDIATE")
    try:
        assert_slot_available(conn, payload.window_id, payload.schedule_date, starts_at)
        reference = generate_reference(conn)
        cursor = conn.execute(
            """
            INSERT INTO appointments(
                reference, window_id, schedule_date, starts_at, ends_at,
                status, resident_name, note
            ) VALUES (?, ?, ?, ?, ?, 'booked', ?, ?)
            """,
            (
                reference,
                payload.window_id,
                payload.schedule_date.isoformat(),
                time_to_str(starts_at),
                time_to_str(ends_at),
                normalize_text(payload.resident_name),
                normalize_text(payload.note),
            ),
        )
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise http_error(status.HTTP_409_CONFLICT, "该时段刚刚被占用，请选择其他空档") from exc
    return appointment_dict(get_appointment_or_404(conn, cursor.lastrowid))


@app.get("/api/appointments/lookup/{reference}")
def lookup_appointment(reference: str, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    return appointment_dict(get_owned_appointment_or_404(conn, reference))


@app.post("/api/appointments/lookup/{reference}/reschedule")
def reschedule_appointment(
    reference: str,
    payload: AppointmentReschedule,
    conn: sqlite3.Connection = DbDep,
) -> dict[str, Any]:
    appointment = get_owned_appointment_or_404(conn, reference)
    if appointment["status"] != ACTIVE_STATUS:
        raise http_error(status.HTTP_409_CONFLICT, "当前状态不能改期；只有已预约状态可以改期")
    schedule = get_schedule_or_404(conn, payload.window_id, payload.schedule_date, require_active_window=True)
    starts_at, ends_at = validate_bookable_slot(schedule, payload.starts_at)
    conn.execute("BEGIN IMMEDIATE")
    try:
        assert_slot_available(
            conn,
            payload.window_id,
            payload.schedule_date,
            starts_at,
            exclude_appointment_id=appointment["id"],
        )
        conn.execute(
            """
            UPDATE appointments
            SET window_id = ?, schedule_date = ?, starts_at = ?, ends_at = ?,
                status = 'booked', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                payload.window_id,
                payload.schedule_date.isoformat(),
                time_to_str(starts_at),
                time_to_str(ends_at),
                appointment["id"],
            ),
        )
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise http_error(status.HTTP_409_CONFLICT, "该时段刚刚被占用，请选择其他空档") from exc
    return appointment_dict(get_appointment_or_404(conn, appointment["id"]))


@app.post("/api/appointments/lookup/{reference}/cancel")
def cancel_appointment(reference: str, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    appointment = get_owned_appointment_or_404(conn, reference)
    if appointment["status"] != ACTIVE_STATUS:
        raise http_error(status.HTTP_409_CONFLICT, "当前状态不能取消；只有已预约状态可以取消")
    conn.execute(
        "UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (appointment["id"],),
    )
    conn.commit()
    return appointment_dict(get_appointment_or_404(conn, appointment["id"]))


@app.get("/api/appointments")
def admin_list_appointments(
    schedule_date: date | None = None,
    status_filter: str | None = None,
    conn: sqlite3.Connection = DbDep,
) -> list[dict[str, Any]]:
    if status_filter is not None and status_filter not in APPROVED_STATUSES:
        raise http_error(status.HTTP_400_BAD_REQUEST, "未知预约状态")
    sql = """
        SELECT a.*, sw.name AS window_name, sw.service_name
        FROM appointments a JOIN service_windows sw ON sw.id = a.window_id
    """
    clauses: list[str] = []
    params: list[Any] = []
    if schedule_date is not None:
        clauses.append("a.schedule_date = ?")
        params.append(schedule_date.isoformat())
    if status_filter is not None:
        clauses.append("a.status = ?")
        params.append(status_filter)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY a.schedule_date ASC, a.starts_at ASC, sw.name ASC"
    return [appointment_dict(row) for row in conn.execute(sql, params)]


@app.post("/api/appointments/{appointment_id}/status", status_code=status.HTTP_200_OK)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    conn: sqlite3.Connection = DbDep,
) -> dict[str, Any]:
    appointment = get_appointment_or_404(conn, appointment_id)
    current = appointment["status"]
    target = payload.status
    if current in {"cancelled", "no_show"}:
        raise http_error(status.HTTP_409_CONFLICT, "已取消或爽约的预约不能再变更状态")
    if current == "completed" and target != "completed":
        raise http_error(status.HTTP_409_CONFLICT, "已完成的预约不能再变更状态")
    if target == "cancelled" and current not in {"booked", "called", "late"}:
        raise http_error(status.HTTP_409_CONFLICT, "当前状态不能取消")
    if target == "booked" and current not in {"called", "late"}:
        raise http_error(status.HTTP_409_CONFLICT, "只有叫号或迟到记录可恢复为已预约")
    conn.execute(
        "UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (target, appointment_id),
    )
    conn.commit()
    return appointment_dict(get_appointment_or_404(conn, appointment_id))


@app.get("/api/dashboard")
def dashboard(schedule_date: date | None = None, conn: sqlite3.Connection = DbDep) -> dict[str, Any]:
    target_date = schedule_date or date.today()
    schedules = list_schedules(target_date, conn, include_inactive=True)
    queue = [
        appointment_dict(row)
        for row in conn.execute(
            """
            SELECT a.*, sw.name AS window_name, sw.service_name
            FROM appointments a JOIN service_windows sw ON sw.id = a.window_id
            WHERE a.schedule_date = ?
            ORDER BY a.starts_at ASC, sw.name ASC, a.id ASC
            """,
            (target_date.isoformat(),),
        )
    ]
    windows_gaps: list[dict[str, Any]] = []
    for schedule in schedules:
        availability = availability_payload(conn, schedule["window_id"], target_date)
        windows_gaps.append(
            {
                "schedule_id": schedule["id"],
                "window_id": schedule["window_id"],
                "window_name": schedule["window_name"],
                "service_name": schedule["service_name"],
                "is_active": bool(schedule.get("is_active", True)),
                "opens_at": schedule["opens_at"],
                "closes_at": schedule["closes_at"],
                "duration_minutes": schedule["duration_minutes"],
                "slots": availability["slots"],
            }
        )
    return {
        "schedule_date": target_date.isoformat(),
        "current_time": datetime.now().strftime("%H:%M"),
        "queue": queue,
        "windows": windows_gaps,
    }


STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
