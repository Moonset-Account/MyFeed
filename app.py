"""盘点差异助手 - FastAPI 入口。同一进程提供页面与业务接口。"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

from stocktake import DuplicateCountError, ImportError_, Stocktake, UnknownSkuError

BASE_DIR = Path(__file__).resolve().parent
SAMPLE_CSV = BASE_DIR / "sample_data" / "products_sample.csv"

app = FastAPI(title="盘点差异助手")
store = Stocktake()


class CountIn(BaseModel):
    sku: str
    qty: int = Field(ge=0)
    overwrite: bool = False


class ReasonIn(BaseModel):
    sku: str
    reason: str


class ImportIn(BaseModel):
    csv_text: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/static/{filename}")
def static_file(filename: str) -> FileResponse:
    path = BASE_DIR / "static" / filename
    if not path.is_file() or path.parent != BASE_DIR / "static":
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path)


@app.post("/api/products/import")
def import_products(payload: ImportIn) -> dict:
    try:
        result = store.import_csv(payload.csv_text)
    except ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {**result, "summary": store.summary()}


@app.post("/api/sample")
def load_sample() -> dict:
    result = store.import_csv(SAMPLE_CSV.read_text(encoding="utf-8"))
    return {**result, "summary": store.summary()}


@app.post("/api/reset")
def reset() -> dict:
    store.reset()
    return {"summary": store.summary()}


@app.get("/api/products")
def list_products() -> dict:
    return {"items": store.list_products(), "summary": store.summary()}


@app.post("/api/count", status_code=200)
def record_count(payload: CountIn) -> JSONResponse:
    try:
        product = store.record_count(payload.sku, payload.qty, overwrite=payload.overwrite)
    except DuplicateCountError as exc:
        # 重复扫码/录入：不覆盖，返回 409 让前端向用户确认
        return JSONResponse(status_code=409, content={
            "detail": str(exc),
            "conflict": True,
            "sku": exc.sku,
            "existing_qty": exc.existing_qty,
            "new_qty": exc.new_qty,
        })
    except UnknownSkuError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return JSONResponse({"item": product.to_dict(), "summary": store.summary()})


@app.post("/api/reason")
def set_reason(payload: ReasonIn) -> dict:
    try:
        product = store.set_reason(payload.sku, payload.reason)
    except UnknownSkuError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"item": product.to_dict()}


@app.get("/api/diffs")
def diffs(by: str = "shelf") -> dict:
    try:
        groups = store.diffs_by(by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"by": by, "groups": groups, "summary": store.summary()}


@app.get("/api/review")
def review() -> dict:
    return {"rows": store.review_rows(), "summary": store.summary()}


def _csv_response(text: str, filename: str) -> PlainTextResponse:
    return PlainTextResponse(
        "\ufeff" + text,  # BOM，方便 Excel 直接打开中文
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/export/counts")
def export_counts() -> PlainTextResponse:
    return _csv_response(store.export_counts_csv(), "stocktake_counts.csv")


@app.get("/api/export/review")
def export_review() -> PlainTextResponse:
    return _csv_response(store.export_review_csv(), "stocktake_review.csv")
