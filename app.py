from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("CLEANING_DB", BASE_DIR / "cleaning.db"))
LOCAL_TZ = timezone(timedelta(hours=8))

DEFAULT_CHECKLIST = [
    "更换并整理床品",
    "清洁卫生间并补充洗护用品",
    "清空垃圾并更换垃圾袋",
    "擦拭桌面、台面与开关",
    "检查毛巾、纸巾和饮用水",
    "开窗通风并确认无遗留物品",
]
DEFAULT_SUPPLIES = [
    ("毛巾", "条"),
    ("浴巾", "条"),
    ("牙具套装", "套"),
    ("纸巾", "包"),
    ("瓶装水", "瓶"),
    ("垃圾袋", "个"),
]

ACTIVE_TASK_STATES = ("scheduled", "waiting", "assigned", "in_progress", "inspection", "rejected")
STATE_LABELS = {
    "scheduled": "已排退房",
    "waiting": "待清扫",
    "assigned": "已分配",
    "in_progress": "清扫中",
    "inspection": "待复查",
    "rejected": "复查未通过",
    "passed": "复查通过",
    "approved": "空房可入住",
}
PRIORITY_LABELS = {
    "overdue_recheck": "返工优先",
    "overdue": "超时优先",
    "soon": "近期退房",
    "later": "今日稍后",
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") if dt else None


def parse_local_datetime(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("时间格式应为 YYYY-MM-DDTHH:MM，例如 2026-09-30T11:00") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=LOCAL_TZ)
    return parsed.astimezone(timezone.utc)


def local_date_bounds(day: str) -> tuple[datetime, datetime]:
    try:
        start_local = datetime.combine(datetime.strptime(day, "%Y-%m-%d").date(), datetime.min.time(), LOCAL_TZ)
    except ValueError as exc:
        raise ValueError("日期格式应为 YYYY-MM-DD") from exc
    return start_local.astimezone(timezone.utc), (start_local + timedelta(days=1)).astimezone(timezone.utc)


def today_local() -> str:
    return now_utc().astimezone(LOCAL_TZ).date().isoformat()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            floor TEXT DEFAULT '',
            note TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cleaners (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS checklist_items (
            id INTEGER PRIMARY KEY,
            room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            room_id INTEGER NOT NULL REFERENCES rooms(id),
            cleaner_id INTEGER REFERENCES cleaners(id),
            checkout_at TEXT NOT NULL,
            status TEXT NOT NULL,
            inspection_note TEXT DEFAULT '',
            completed_at TEXT,
            inspected_at TEXT,
            approved_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS task_items (
            id INTEGER PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS task_events (
            id INTEGER PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            actor TEXT DEFAULT '',
            detail TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS supply_items (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            unit TEXT NOT NULL DEFAULT '件',
            active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS supply_records (
            id INTEGER PRIMARY KEY,
            task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
            room_id INTEGER REFERENCES rooms(id),
            supply_item_id INTEGER NOT NULL REFERENCES supply_items(id),
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            note TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            local_date TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(checkout_at, status);
        CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id, id);
        CREATE INDEX IF NOT EXISTS idx_supply_date ON supply_records(local_date);
        """
    )
    if conn.execute("SELECT COUNT(*) FROM supply_items").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO supply_items(name, unit, active) VALUES (?, ?, 1)",
            DEFAULT_SUPPLIES,
        )
    conn.commit()


def add_event(conn: sqlite3.Connection, task_id: int, action: str, actor: str = "", detail: str = "") -> None:
    conn.execute(
        "INSERT INTO task_events(task_id, action, actor, detail, created_at) VALUES (?, ?, ?, ?, ?)",
        (task_id, action, actor.strip(), detail.strip(), iso(now_utc())),
    )


def touch_task(conn: sqlite3.Connection, task_id: int, **changes: Any) -> None:
    fields = [f"{key} = ?" for key in changes]
    values = list(changes.values())
    if fields:
        conn.execute(f"UPDATE tasks SET {', '.join(fields)}, updated_at = ? WHERE id = ?", (*values, iso(now_utc()), task_id))


def require_room(conn: sqlite3.Connection, room_id: int) -> sqlite3.Row:
    room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    return room


def require_cleaner(conn: sqlite3.Connection, cleaner_id: int | None) -> sqlite3.Row | None:
    if cleaner_id is None:
        return None
    cleaner = conn.execute("SELECT * FROM cleaners WHERE id = ? AND active = 1", (cleaner_id,)).fetchone()
    if cleaner is None:
        raise HTTPException(status_code=404, detail="清扫人员不存在或已停用")
    return cleaner


def get_task_or_404(conn: sqlite3.Connection, task_id: int) -> sqlite3.Row:
    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if task is None:
        raise HTTPException(status_code=404, detail="清扫任务不存在")
    return task


def latest_task_subquery() -> str:
    return """
        LEFT JOIN tasks lt ON lt.id = (
            SELECT t.id FROM tasks t WHERE t.room_id = rooms.id ORDER BY t.id DESC LIMIT 1
        )
    """


def task_checkout_dt(task: sqlite3.Row | dict[str, Any]) -> datetime:
    return datetime.fromisoformat(task["checkout_at"])


def decorate_task(row: sqlite3.Row | dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    data = dict(row)
    current = now or now_utc()
    checkout = task_checkout_dt(data)
    data["checkout_local"] = checkout.astimezone(LOCAL_TZ).strftime("%Y-%m-%d %H:%M")
    data["status_label"] = STATE_LABELS.get(data["status"], data["status"])
    data["is_active"] = data["status"] in ACTIVE_TASK_STATES
    if data["status"] == "rejected":
        priority, rank = "overdue_recheck", 0
    elif checkout <= current and data["status"] in {"waiting", "assigned", "in_progress"}:
        priority, rank = "overdue", 1
    elif data["status"] == "scheduled":
        priority, rank = ("soon", 2) if checkout <= current + timedelta(hours=4) else ("later", 3)
    else:
        priority, rank = ("overdue", 1) if checkout <= current else ("soon", 2)
    data["priority"] = priority
    data["priority_label"] = PRIORITY_LABELS[priority]
    data["priority_rank"] = rank
    data["overdue_minutes"] = max(0, int((current - checkout).total_seconds() // 60)) if checkout < current else 0
    return data


def serialize_room(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    latest = conn.execute("SELECT * FROM tasks WHERE room_id = ? ORDER BY id DESC LIMIT 1", (data["id"],)).fetchone()
    data["latest_task"] = decorate_task(latest) if latest else None
    data["status"] = latest["status"] if latest else "ready"
    data["status_label"] = STATE_LABELS.get(data["status"], "空房可入住")
    data["ready"] = data["status"] in {"ready", "approved"}
    data["can_checkin"] = data["ready"]
    return data


def task_items(conn: sqlite3.Connection, task_id: int) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM task_items WHERE task_id = ? ORDER BY sort_order, id", (task_id,)).fetchall()
    return [dict(row) for row in rows]


def task_events(conn: sqlite3.Connection, task_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT e.*, c.name AS cleaner_name
        FROM task_events e
        LEFT JOIN cleaners c ON c.id = (
            SELECT t.cleaner_id FROM tasks t WHERE t.id = e.task_id
        )
        WHERE e.task_id = ? ORDER BY e.id DESC
        """,
        (task_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def serialize_task(conn: sqlite3.Connection, row: sqlite3.Row, include_items: bool = True) -> dict[str, Any]:
    data = decorate_task(row)
    room = conn.execute("SELECT * FROM rooms WHERE id = ?", (data["room_id"],)).fetchone()
    cleaner = conn.execute("SELECT * FROM cleaners WHERE id = ?", (data["cleaner_id"],)).fetchone() if data["cleaner_id"] else None
    data["room_name"] = room["name"] if room else f"房间 #{data['room_id']}"
    data["cleaner_name"] = cleaner["name"] if cleaner else ""
    data["items"] = task_items(conn, data["id"]) if include_items else []
    data["events"] = task_events(conn, data["id"]) if include_items else []
    return data


def ensure_no_active_task(conn: sqlite3.Connection, room_id: int) -> None:
    placeholders = ",".join("?" for _ in ACTIVE_TASK_STATES)
    row = conn.execute(
        f"SELECT id FROM tasks WHERE room_id = ? AND status IN ({placeholders}) ORDER BY id DESC LIMIT 1",
        (room_id, *ACTIVE_TASK_STATES),
    ).fetchone()
    if row:
        raise HTTPException(status_code=409, detail="该房间已有未完成的清扫任务")


def promote_due_tasks(conn: sqlite3.Connection, current: datetime | None = None) -> int:
    current = current or now_utc()
    rows = conn.execute(
        "SELECT * FROM tasks WHERE status = 'scheduled' AND checkout_at <= ?",
        (iso(current),),
    ).fetchall()
    for row in rows:
        next_status = "assigned" if row["cleaner_id"] else "waiting"
        touch_task(conn, row["id"], status=next_status)
        add_event(conn, row["id"], "checkout", "系统", "到达退房时间，生成待清扫任务")
    if rows:
        conn.commit()
    return len(rows)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    floor: str = Field(default="", max_length=30)
    note: str = Field(default="", max_length=200)
    checklist: list[str] = Field(default_factory=list)

    @field_validator("name", "floor", "note")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CleanerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)

    @field_validator("name")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class TaskCreate(BaseModel):
    room_id: int
    checkout_at: str
    cleaner_id: int | None = None


class TaskAssign(BaseModel):
    cleaner_id: int


class TaskItemUpdate(BaseModel):
    done: bool


class InspectTask(BaseModel):
    passed: bool
    note: str = Field(default="", max_length=300)
    inspector: str = Field(default="前台", max_length=30)


class ActorRequest(BaseModel):
    actor: str = Field(default="前台", max_length=30)


class SupplyCreate(BaseModel):
    room_id: int | None = None
    supply_item_id: int
    quantity: int = Field(gt=0, le=999)
    note: str = Field(default="", max_length=200)
    task_id: int | None = None
    created_at: str | None = None

    @field_validator("note")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class SupplyItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    unit: str = Field(min_length=1, max_length=10)


@asynccontextmanager
async def lifespan(_: FastAPI):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        init_db(conn)
    finally:
        conn.close()
    yield


app = FastAPI(title="客房清扫看板", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
DB = Depends(get_db)


@app.exception_handler(sqlite3.IntegrityError)
def integrity_handler(_: Request, exc: sqlite3.IntegrityError) -> JSONResponse:
    message = str(exc).lower()
    detail = "名称不能重复" if "unique" in message else "数据约束未通过，请检查关联记录"
    return JSONResponse(status_code=409, content={"detail": detail})


@app.exception_handler(ValueError)
def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def home() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/overview")
def overview(conn: sqlite3.Connection = DB) -> dict[str, Any]:
    promote_due_tasks(conn)
    rooms = conn.execute("SELECT * FROM rooms ORDER BY id").fetchall()
    active_rows = conn.execute(
        f"SELECT * FROM tasks WHERE status IN ({','.join('?' for _ in ACTIVE_TASK_STATES)})",
        ACTIVE_TASK_STATES,
    ).fetchall()
    active = [decorate_task(row) for row in active_rows]
    current = now_utc()
    return {
        "today": today_local(),
        "rooms_total": len(rooms),
        "ready_rooms": sum(1 for row in rooms if serialize_room(conn, row)["ready"]),
        "waiting_count": sum(1 for item in active if item["status"] in {"waiting", "rejected"}),
        "overdue_count": sum(1 for item in active if item["overdue_minutes"] > 0 and item["status"] != "passed"),
        "cleaners": [dict(row) for row in conn.execute("SELECT * FROM cleaners WHERE active = 1 ORDER BY name").fetchall()],
        "supply_items": [dict(row) for row in conn.execute("SELECT * FROM supply_items WHERE active = 1 ORDER BY id").fetchall()],
        "now": iso(current),
    }


@app.get("/api/rooms")
def list_rooms(conn: sqlite3.Connection = DB) -> list[dict[str, Any]]:
    promote_due_tasks(conn)
    rows = conn.execute("SELECT * FROM rooms ORDER BY CAST(name AS INTEGER), name, id").fetchall()
    return [serialize_room(conn, row) for row in rows]


@app.post("/api/rooms", status_code=201)
def create_room(payload: RoomCreate, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    stamp = iso(now_utc())
    cur = conn.execute(
        "INSERT INTO rooms(name, floor, note, created_at) VALUES (?, ?, ?, ?)",
        (payload.name, payload.floor, payload.note, stamp),
    )
    room_id = int(cur.lastrowid)
    labels = payload.checklist or DEFAULT_CHECKLIST
    seen: set[str] = set()
    clean_labels = []
    for label in labels:
        value = label.strip()
        if value and value not in seen:
            seen.add(value)
            clean_labels.append(value[:80])
    conn.executemany(
        "INSERT INTO checklist_items(room_id, label, active, sort_order) VALUES (?, ?, 1, ?)",
        [(room_id, label, index) for index, label in enumerate(clean_labels)],
    )
    conn.commit()
    return serialize_room(conn, require_room(conn, room_id))


@app.get("/api/rooms/{room_id}")
def get_room(room_id: int, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    return serialize_room(conn, require_room(conn, room_id))


@app.get("/api/rooms/{room_id}/history")
def room_history(room_id: int, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    room = require_room(conn, room_id)
    task_rows = conn.execute("SELECT * FROM tasks WHERE room_id = ? ORDER BY id DESC", (room_id,)).fetchall()
    supplies = conn.execute(
        """
        SELECT sr.*, si.name AS supply_name, si.unit
        FROM supply_records sr
        JOIN supply_items si ON si.id = sr.supply_item_id
        WHERE sr.room_id = ?
        ORDER BY sr.id DESC
        """,
        (room_id,),
    ).fetchall()
    return {
        "room": serialize_room(conn, room),
        "tasks": [serialize_task(conn, row) for row in task_rows],
        "supplies": [dict(row) for row in supplies],
    }


@app.get("/api/cleaners")
def list_cleaners(conn: sqlite3.Connection = DB) -> list[dict[str, Any]]:
    return [dict(row) for row in conn.execute("SELECT * FROM cleaners ORDER BY active DESC, name").fetchall()]


@app.post("/api/cleaners", status_code=201)
def create_cleaner(payload: CleanerCreate, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    cur = conn.execute(
        "INSERT INTO cleaners(name, active, created_at) VALUES (?, 1, ?)",
        (payload.name, iso(now_utc())),
    )
    conn.commit()
    return dict(conn.execute("SELECT * FROM cleaners WHERE id = ?", (cur.lastrowid,)).fetchone())


@app.get("/api/checklist-defaults")
def checklist_defaults() -> dict[str, list[str]]:
    return {"items": DEFAULT_CHECKLIST}


@app.get("/api/tasks")
def list_tasks(
    status: str | None = Query(default=None),
    day: str | None = Query(default=None),
    conn: sqlite3.Connection = DB,
) -> list[dict[str, Any]]:
    promote_due_tasks(conn)
    sql = """
        SELECT t.*, r.name AS room_name, c.name AS cleaner_name
        FROM tasks t
        JOIN rooms r ON r.id = t.room_id
        LEFT JOIN cleaners c ON c.id = t.cleaner_id
    """
    where = []
    params: list[Any] = []
    if status:
        states = [item.strip() for item in status.split(",") if item.strip()]
        where.append(f"t.status IN ({','.join('?' for _ in states)})")
        params.extend(states)
    if day:
        start, end = local_date_bounds(day)
        where.append("t.checkout_at >= ? AND t.checkout_at < ?")
        params.extend((iso(start), iso(end)))
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY t.checkout_at ASC, t.id ASC"
    rows = conn.execute(sql, params).fetchall()
    return [serialize_task(conn, row, include_items=False) for row in rows]


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    room = require_room(conn, payload.room_id)
    cleaner = require_cleaner(conn, payload.cleaner_id)
    checkout = parse_local_datetime(payload.checkout_at)
    ensure_no_active_task(conn, room["id"])
    stamp = iso(now_utc())
    due = checkout <= now_utc()
    status = "scheduled" if not due else ("assigned" if cleaner else "waiting")
    cur = conn.execute(
        """
        INSERT INTO tasks(room_id, cleaner_id, checkout_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (room["id"], cleaner["id"] if cleaner else None, iso(checkout), status, stamp, stamp),
    )
    task_id = int(cur.lastrowid)
    items = conn.execute(
        "SELECT label, sort_order FROM checklist_items WHERE room_id = ? AND active = 1 ORDER BY sort_order, id",
        (room["id"],),
    ).fetchall()
    if not items:
        conn.executemany(
            "INSERT INTO task_items(task_id, label, done, sort_order) VALUES (?, ?, 0, ?)",
            [(task_id, label, index) for index, label in enumerate(DEFAULT_CHECKLIST)],
        )
    else:
        conn.executemany(
            "INSERT INTO task_items(task_id, label, done, sort_order) VALUES (?, ?, 0, ?)",
            [(task_id, row["label"], row["sort_order"]) for row in items],
        )
    add_event(conn, task_id, "created", "前台", f"登记退房时间：{checkout.astimezone(LOCAL_TZ).strftime('%Y-%m-%d %H:%M')}")
    if status == "waiting":
        add_event(conn, task_id, "checkout", "系统", "退房时间已到，生成待清扫任务")
    if cleaner:
        detail = f"分配给 {cleaner['name']}" if status == "assigned" else f"预分配给 {cleaner['name']}，退房后进入清扫"
        add_event(conn, task_id, "assigned", "前台", detail)
    conn.commit()
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    promote_due_tasks(conn)
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.post("/api/tasks/{task_id}/assign")
def assign_task(task_id: int, payload: TaskAssign, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    task = get_task_or_404(conn, task_id)
    cleaner = require_cleaner(conn, payload.cleaner_id)
    if task["status"] not in {"waiting", "rejected", "assigned"}:
        raise HTTPException(status_code=409, detail="当前状态不能分配清扫人员")
    touch_task(conn, task_id, cleaner_id=cleaner["id"])
    add_event(conn, task_id, "assigned", "前台", f"分配给 {cleaner['name']}")
    conn.commit()
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.post("/api/tasks/{task_id}/start")
def start_task(task_id: int, payload: ActorRequest, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    task = get_task_or_404(conn, task_id)
    if task["status"] not in {"assigned", "rejected"}:
        raise HTTPException(status_code=409, detail="只有已分配或返工任务可以开始清扫")
    if not task["cleaner_id"]:
        raise HTTPException(status_code=409, detail="请先分配清扫人员")
    touch_task(conn, task_id, status="in_progress")
    add_event(conn, task_id, "started", payload.actor, "开始清扫")
    conn.commit()
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.patch("/api/tasks/{task_id}/items/{item_id}")
def update_task_item(task_id: int, item_id: int, payload: TaskItemUpdate, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    get_task_or_404(conn, task_id)
    item = conn.execute("SELECT * FROM task_items WHERE id = ? AND task_id = ?", (item_id, task_id)).fetchone()
    if item is None:
        raise HTTPException(status_code=404, detail="检查项不存在")
    conn.execute("UPDATE task_items SET done = ? WHERE id = ?", (1 if payload.done else 0, item_id))
    conn.commit()
    return dict(conn.execute("SELECT * FROM task_items WHERE id = ?", (item_id,)).fetchone())


@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: int, payload: ActorRequest, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    task = get_task_or_404(conn, task_id)
    if task["status"] != "in_progress":
        raise HTTPException(status_code=409, detail="只有清扫中的任务可以提交复查")
    unchecked = conn.execute("SELECT COUNT(*) FROM task_items WHERE task_id = ? AND done = 0", (task_id,)).fetchone()[0]
    if unchecked:
        raise HTTPException(status_code=409, detail=f"还有 {unchecked} 个检查项未完成")
    stamp = iso(now_utc())
    touch_task(conn, task_id, status="inspection", completed_at=stamp)
    add_event(conn, task_id, "completed", payload.actor, "清扫完成，等待复查")
    conn.commit()
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.post("/api/tasks/{task_id}/inspect")
def inspect_task(task_id: int, payload: InspectTask, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    task = get_task_or_404(conn, task_id)
    if task["status"] != "inspection":
        raise HTTPException(status_code=409, detail="只有待复查任务可以复查")
    note = payload.note.strip()
    if not payload.passed and not note:
        raise HTTPException(status_code=422, detail="复查未通过时必须填写整改说明")
    stamp = iso(now_utc())
    if payload.passed:
        touch_task(conn, task_id, status="passed", inspection_note=note, inspected_at=stamp)
        add_event(conn, task_id, "inspection_passed", payload.inspector, note or "复查通过")
    else:
        touch_task(conn, task_id, status="rejected", inspection_note=note, inspected_at=stamp)
        conn.execute("UPDATE task_items SET done = 0 WHERE task_id = ?", (task_id,))
        add_event(conn, task_id, "inspection_rejected", payload.inspector, note)
    conn.commit()
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.post("/api/tasks/{task_id}/ready")
def mark_ready(task_id: int, payload: ActorRequest, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    task = get_task_or_404(conn, task_id)
    if task["status"] != "passed":
        raise HTTPException(status_code=409, detail="复查未通过的房间不能标为空房可入住")
    stamp = iso(now_utc())
    touch_task(conn, task_id, status="approved", approved_at=stamp)
    add_event(conn, task_id, "approved", payload.actor, "确认空房可入住")
    conn.commit()
    return serialize_task(conn, get_task_or_404(conn, task_id))


@app.get("/api/board")
def board(day: str | None = Query(default=None), conn: sqlite3.Connection = DB) -> dict[str, Any]:
    selected_day = day or today_local()
    promote_due_tasks(conn)
    start, end = local_date_bounds(selected_day)
    active_placeholders = ",".join("?" for _ in ACTIVE_TASK_STATES)
    rows = conn.execute(
        f"""
        SELECT t.*, r.name AS room_name, c.name AS cleaner_name
        FROM tasks t
        JOIN rooms r ON r.id = t.room_id
        LEFT JOIN cleaners c ON c.id = t.cleaner_id
        WHERE (
            t.status IN ({active_placeholders}) AND t.checkout_at < ?
        ) OR (
            t.status NOT IN ({active_placeholders})
            AND t.checkout_at >= ? AND t.checkout_at < ?
        )
        ORDER BY t.checkout_at ASC, t.id ASC
        """,
        (*ACTIVE_TASK_STATES, iso(end), *ACTIVE_TASK_STATES, iso(start), iso(end)),
    ).fetchall()
    tasks = [serialize_task(conn, row, include_items=False) for row in rows]
    queued = [task for task in tasks if task["status"] in ACTIVE_TASK_STATES and task["status"] != "passed"]
    queued.sort(key=lambda item: (item["priority_rank"], item["overdue_minutes"] == 0, item["checkout_at"], item["id"]))
    finished = [task for task in tasks if task["status"] not in ACTIVE_TASK_STATES]
    finished.sort(key=lambda item: item.get("approved_at") or item.get("inspected_at") or item["checkout_at"], reverse=True)
    supplies = conn.execute(
        """
        SELECT sr.*, si.name AS supply_name, si.unit
        FROM supply_records sr
        JOIN supply_items si ON si.id = sr.supply_item_id
        WHERE sr.local_date = ?
        ORDER BY sr.id DESC
        """,
        (selected_day,),
    ).fetchall()
    return {"day": selected_day, "tasks": queued, "finished": finished, "supplies": [dict(row) for row in supplies]}


@app.get("/api/supplies")
def list_supplies(day: str | None = Query(default=None), conn: sqlite3.Connection = DB) -> list[dict[str, Any]]:
    sql = """
        SELECT sr.*, si.name AS supply_name, si.unit, r.name AS room_name
        FROM supply_records sr
        JOIN supply_items si ON si.id = sr.supply_item_id
        LEFT JOIN rooms r ON r.id = sr.room_id
    """
    params: list[Any] = []
    if day:
        local_date_bounds(day)
        sql += " WHERE sr.local_date = ?"
        params.append(day)
    sql += " ORDER BY sr.id DESC"
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


@app.get("/api/supply-items")
def list_supply_items(conn: sqlite3.Connection = DB) -> list[dict[str, Any]]:
    return [dict(row) for row in conn.execute("SELECT * FROM supply_items WHERE active = 1 ORDER BY id").fetchall()]


@app.post("/api/supplies", status_code=201)
def create_supply(payload: SupplyCreate, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    item = conn.execute("SELECT * FROM supply_items WHERE id = ? AND active = 1", (payload.supply_item_id,)).fetchone()
    if item is None:
        raise HTTPException(status_code=404, detail="用品不存在")
    task = None
    room_id = payload.room_id
    if payload.task_id:
        task = get_task_or_404(conn, payload.task_id)
        room_id = task["room_id"]
    elif room_id is not None:
        require_room(conn, room_id)
    created = parse_local_datetime(payload.created_at) if payload.created_at else now_utc()
    cur = conn.execute(
        """
        INSERT INTO supply_records(task_id, room_id, supply_item_id, quantity, note, created_at, local_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.task_id,
            room_id,
            payload.supply_item_id,
            payload.quantity,
            payload.note,
            iso(created),
            created.astimezone(LOCAL_TZ).date().isoformat(),
        ),
    )
    record_id = int(cur.lastrowid)
    if task:
        add_event(conn, task["id"], "supply", "仓库", f"补充 {item['name']} × {payload.quantity}{item['unit']}")
    conn.commit()
    row = conn.execute(
        """
        SELECT sr.*, si.name AS supply_name, si.unit, r.name AS room_name
        FROM supply_records sr
        JOIN supply_items si ON si.id = sr.supply_item_id
        LEFT JOIN rooms r ON r.id = sr.room_id
        WHERE sr.id = ?
        """,
        (record_id,),
    ).fetchone()
    return dict(row)


@app.post("/api/supply-items", status_code=201)
def create_supply_item(payload: SupplyItemCreate, conn: sqlite3.Connection = DB) -> dict[str, Any]:
    cur = conn.execute("INSERT INTO supply_items(name, unit, active) VALUES (?, ?, 1)", (payload.name.strip(), payload.unit.strip()))
    conn.commit()
    return dict(conn.execute("SELECT * FROM supply_items WHERE id = ?", (cur.lastrowid,)).fetchone())
