"""盘点差异助手：FastAPI 后端。

单进程提供页面与业务接口，数据保存在内存中（演示用途），
通过 CSV 导入/导出完成数据交换，不连接任何外部库存系统。
"""
from __future__ import annotations

import csv
import io
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
SAMPLE_CSV = BASE_DIR / "sample_products.csv"

REASON_CODES = ["正常损耗", "破损报废", "丢失", "进货未入账", "销售未入账", "盘点错误", "其他"]

IMPORT_FIELDS = ["sku", "name", "category", "shelf", "book_qty"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class StocktakeStore:
    """内存中的盘点会话。重复录入默认拒绝，需显式确认才覆盖。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: dict[str, dict] = {}

    # ---- 商品清单 ----
    def import_items(self, rows: list[dict]) -> dict:
        """用商品清单开启新一轮盘点，清空旧的盘点数据。"""
        items: dict[str, dict] = {}
        for row in rows:
            sku = row["sku"]
            if sku in items:
                raise ValueError(f"清单中 SKU 重复：{sku}")
            items[sku] = {
                "sku": sku,
                "name": row["name"],
                "category": row["category"],
                "shelf": row["shelf"],
                "book_qty": row["book_qty"],
                "actual_qty": None,
                "counted_at": None,
                "revisions": 0,
                "reason": "",
                "reason_note": "",
            }
        if not items:
            raise ValueError("清单为空")
        with self._lock:
            self._items = items
        return {"imported": len(items)}

    # ---- 盘点录入 ----
    def record_count(self, sku: str, qty: int, confirm_overwrite: bool) -> dict:
        with self._lock:
            item = self._items.get(sku)
            if item is None:
                raise KeyError(sku)
            if item["actual_qty"] is not None and not confirm_overwrite:
                raise FileExistsError(sku)
            item["revisions"] += 1 if item["actual_qty"] is not None else 0
            item["actual_qty"] = qty
            item["counted_at"] = _now_iso()
            return dict(item)

    def clear_count(self, sku: str) -> dict:
        with self._lock:
            item = self._items.get(sku)
            if item is None:
                raise KeyError(sku)
            item["actual_qty"] = None
            item["counted_at"] = None
            return dict(item)

    # ---- 差异原因 ----
    def record_reason(self, sku: str, reason: str, note: str) -> dict:
        with self._lock:
            item = self._items.get(sku)
            if item is None:
                raise KeyError(sku)
            item["reason"] = reason
            item["reason_note"] = note
            return dict(item)

    # ---- 查询 ----
    def snapshot(self) -> list[dict]:
        with self._lock:
            return [dict(it) for it in self._items.values()]

    def reset(self) -> None:
        with self._lock:
            self._items = {}


store = StocktakeStore()
app = FastAPI(title="盘点差异助手")


# ---------- 数据整形 ----------

def with_diff(item: dict) -> dict:
    item = dict(item)
    item["diff"] = None if item["actual_qty"] is None else item["actual_qty"] - item["book_qty"]
    return item


def parse_products_csv(text: str) -> list[dict]:
    """解析商品清单 CSV，带表头，字段：sku,name,category,shelf,book_qty。"""
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    if reader.fieldnames is None:
        raise ValueError("CSV 缺少表头")
    missing = [f for f in IMPORT_FIELDS if f not in reader.fieldnames]
    if missing:
        raise ValueError(f"CSV 缺少列：{', '.join(missing)}（需要 {', '.join(IMPORT_FIELDS)}）")
    rows = []
    for lineno, raw in enumerate(reader, start=2):
        sku = (raw.get("sku") or "").strip()
        name = (raw.get("name") or "").strip()
        if not sku or not name:
            raise ValueError(f"第 {lineno} 行：sku 和 name 不能为空")
        try:
            book_qty = int((raw.get("book_qty") or "").strip())
        except ValueError:
            raise ValueError(f"第 {lineno} 行：book_qty 必须是整数") from None
        if book_qty < 0:
            raise ValueError(f"第 {lineno} 行：book_qty 不能为负数")
        rows.append({
            "sku": sku,
            "name": name,
            "category": (raw.get("category") or "").strip() or "未分类",
            "shelf": (raw.get("shelf") or "").strip() or "未分配",
            "book_qty": book_qty,
        })
    return rows


def to_csv(rows: list[dict], fields: list[str]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\r\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k, "") for k in fields})
    return "﻿" + buf.getvalue()  # BOM 便于 Excel 打开


def csv_response(content: str, filename: str) -> Response:
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- 页面与健康检查 ----------

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/static/{path:path}", include_in_schema=False)
def static_files(path: str) -> FileResponse:
    target = (STATIC_DIR / path).resolve()
    if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(target)


# ---------- 商品清单 ----------

@app.post("/api/import")
async def import_products(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="文件必须是 UTF-8 编码的 CSV") from None
    try:
        rows = parse_products_csv(text)
        return store.import_items(rows)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@app.post("/api/sample")
def load_sample() -> dict:
    """载入随源码提供的样例商品清单，便于直接试用。"""
    rows = parse_products_csv(SAMPLE_CSV.read_text(encoding="utf-8-sig"))
    return store.import_items(rows)


@app.get("/api/sample.csv", include_in_schema=False)
def download_sample() -> Response:
    return csv_response(SAMPLE_CSV.read_text(encoding="utf-8-sig"), "sample_products.csv")


@app.post("/api/reset")
def reset() -> dict:
    store.reset()
    return {"reset": True}


# ---------- 盘点录入 ----------

class CountIn(BaseModel):
    sku: str = Field(min_length=1)
    qty: int = Field(ge=0)
    confirm_overwrite: bool = False


@app.post("/api/count")
def record_count(payload: CountIn) -> dict:
    try:
        return with_diff(store.record_count(payload.sku.strip(), payload.qty, payload.confirm_overwrite))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"商品清单中不存在 SKU：{payload.sku}") from None
    except FileExistsError:
        item = next(it for it in store.snapshot() if it["sku"] == payload.sku.strip())
        raise HTTPException(
            status_code=409,
            detail={
                "message": "该商品已录入实盘数量，未覆盖。确认后才会改写。",
                "sku": item["sku"],
                "name": item["name"],
                "existing_qty": item["actual_qty"],
                "new_qty": payload.qty,
                "counted_at": item["counted_at"],
            },
        ) from None


@app.delete("/api/count/{sku}")
def clear_count(sku: str) -> dict:
    try:
        return with_diff(store.clear_count(sku))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"商品清单中不存在 SKU：{sku}") from None


# ---------- 差异原因 ----------

class ReasonIn(BaseModel):
    sku: str = Field(min_length=1)
    reason: str = ""
    note: str = ""


@app.post("/api/reason")
def record_reason(payload: ReasonIn) -> dict:
    if payload.reason and payload.reason not in REASON_CODES:
        raise HTTPException(status_code=400, detail=f"未知差异原因：{payload.reason}")
    try:
        return with_diff(store.record_reason(payload.sku.strip(), payload.reason, payload.note.strip()))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"商品清单中不存在 SKU：{payload.sku}") from None


# ---------- 查询与导出 ----------

@app.get("/api/items")
def list_items() -> dict:
    items = [with_diff(it) for it in store.snapshot()]
    counted = sum(1 for it in items if it["actual_qty"] is not None)
    return {
        "items": items,
        "summary": {
            "total": len(items),
            "counted": counted,
            "remaining": len(items) - counted,
            "with_diff": sum(1 for it in items if it["diff"]),
            "shelves": sorted({it["shelf"] for it in items}),
            "categories": sorted({it["category"] for it in items}),
        },
        "reason_codes": REASON_CODES,
    }


def _group(items: list[dict], key: str) -> list[dict]:
    groups: dict[str, dict] = {}
    for it in items:
        g = groups.setdefault(it[key], {
            "name": it[key], "total": 0, "counted": 0,
            "book_qty": 0, "actual_qty": 0, "diff": 0, "diff_items": 0,
        })
        g["total"] += 1
        g["book_qty"] += it["book_qty"]
        if it["actual_qty"] is not None:
            g["counted"] += 1
            g["actual_qty"] += it["actual_qty"]
            g["diff"] += it["diff"]
            if it["diff"]:
                g["diff_items"] += 1
    return sorted(groups.values(), key=lambda g: g["name"])


@app.get("/api/differences")
def differences(shelf: str = "", category: str = "") -> dict:
    items = [with_diff(it) for it in store.snapshot()]
    if shelf:
        items = [it for it in items if it["shelf"] == shelf]
    if category:
        items = [it for it in items if it["category"] == category]
    return {
        "items": items,
        "by_shelf": _group(items, "shelf"),
        "by_category": _group(items, "category"),
    }


@app.get("/api/review")
def review() -> dict:
    """复盘表：所有存在账实差异的商品及其原因记录。"""
    items = [with_diff(it) for it in store.snapshot()]
    rows = [it for it in items if it["diff"]]
    rows.sort(key=lambda it: (it["shelf"], it["category"], it["sku"]))
    return {
        "rows": rows,
        "missing_reason": sum(1 for it in rows if not it["reason"]),
        "uncounted": sum(1 for it in items if it["actual_qty"] is None),
        "total_book": sum(it["book_qty"] for it in items),
        "total_actual": sum(it["actual_qty"] or 0 for it in items),
        "total_diff": sum(it["diff"] or 0 for it in rows),
    }


EXPORT_FIELDS = ["sku", "name", "category", "shelf", "book_qty", "actual_qty", "diff", "reason", "reason_note", "counted_at"]


@app.get("/api/export/counts.csv")
def export_counts() -> Response:
    items = [with_diff(it) for it in store.snapshot()]
    return csv_response(to_csv(items, EXPORT_FIELDS), "stocktake_counts.csv")


@app.get("/api/export/review.csv")
def export_review() -> Response:
    data = review()
    return csv_response(to_csv(data["rows"], EXPORT_FIELDS), "stocktake_review.csv")
