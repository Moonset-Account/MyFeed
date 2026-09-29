from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

GRAM_QUANTUM = Decimal("0.001")


class BoxIn(BaseModel):
    code: Annotated[str, Field(min_length=1, max_length=64)]
    weight_kg: Decimal

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        code = value.strip()
        if not code:
            raise ValueError("箱号不能为空")
        if any(char in code for char in ("\n", "\r", "\t")):
            raise ValueError("箱号不能包含换行或制表符")
        return code

    @field_validator("weight_kg")
    @classmethod
    def validate_weight(cls, value: Decimal) -> Decimal:
        value = Decimal(str(value))
        if value <= 0:
            raise ValueError("重量必须大于 0")
        if value % GRAM_QUANTUM != 0:
            raise ValueError("重量最多保留 3 位小数")
        return value


class BatchIn(BaseModel):
    parcel: Annotated[str, Field(min_length=1, max_length=100)]
    variety: Annotated[str, Field(min_length=1, max_length=100)]
    harvest_date: date
    weight_kg: Decimal
    boxes: Annotated[list[BoxIn], Field(min_length=1)]

    @field_validator("parcel", "variety")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("该项不能为空")
        return normalized

    @field_validator("weight_kg")
    @classmethod
    def validate_harvest_weight(cls, value: Decimal) -> Decimal:
        value = Decimal(str(value))
        if value <= 0:
            raise ValueError("采收重量必须大于 0")
        if value % GRAM_QUANTUM != 0:
            raise ValueError("重量最多保留 3 位小数")
        return value

    @field_validator("boxes")
    @classmethod
    def reject_duplicate_boxes(cls, boxes: list[BoxIn]) -> list[BoxIn]:
        seen: set[str] = set()
        duplicates: set[str] = set()
        for box in boxes:
            if box.code in seen:
                duplicates.add(box.code)
            seen.add(box.code)
        if duplicates:
            joined = "、".join(sorted(duplicates))
            raise ValueError(f"同一批次内箱号重复：{joined}")
        return boxes


class BoxOut(BaseModel):
    code: str
    weight_kg: str


class BatchOut(BaseModel):
    id: int
    parcel: str
    variety: str
    harvest_date: str
    weight_kg: str
    packed_weight_kg: str
    remaining_kg: str
    boxes: list[BoxOut]


class BoxSourceOut(BaseModel):
    code: str
    weight_kg: str
    remaining_kg: str
    batch_id: int
    parcel: str
    variety: str
    harvest_date: str
    batch_weight_kg: str
    packed_weight_kg: str
