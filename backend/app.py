"""FastAPI application for offline OpenAPI contract review."""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .src.comparator import compare_documents, validate_openapi

app = FastAPI(title="OpenAPI Contract Review", version="1.0.0")

_web_origin = os.environ.get("VITE_WEB_ORIGIN", "http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_web_origin, "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class CompareRequest(BaseModel):
    old: dict[str, Any] = Field(description="Old/current OpenAPI 3.0 JSON document")
    new: dict[str, Any] = Field(description="New/replacement OpenAPI 3.0 JSON document")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/compare")
def compare_contracts(request: CompareRequest) -> dict[str, Any]:
    errors = validate_openapi(request.old, "旧文档") + validate_openapi(request.new, "新文档")
    if errors:
        return {"errors": errors, "summary": None, "operations": []}
    return compare_documents(request.old, request.new)
