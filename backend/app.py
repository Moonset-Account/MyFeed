from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .contract import compare_contracts, validate_openapi_document


class ReviewRequest(BaseModel):
    old: dict[str, Any] = Field(description="Old OpenAPI 3.0 JSON document")
    new: dict[str, Any] = Field(description="New OpenAPI 3.0 JSON document")


app = FastAPI(title="Offline OpenAPI Contract Review", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[Literal["status"], str]:
    return {"status": "ok"}


@app.post("/api/review")
def review(request: ReviewRequest) -> dict[str, Any]:
    try:
        validate_openapi_document(request.old, "旧")
        validate_openapi_document(request.new, "新")
        result = compare_contracts(request.old, request.new)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # Ensure the response is normal JSON even if a user document contains
    # unusual scalar types; Pydantic already validates incoming JSON.
    json.dumps(result, ensure_ascii=False)
    return result
