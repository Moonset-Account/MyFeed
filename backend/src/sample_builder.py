"""Small deterministic schema example builder.

It creates only examples needed to illustrate concrete breaking constraints.
Cycles are treated as non-constructable and result in ``None``.
"""
from __future__ import annotations

from typing import Any

from .resolver import resolve

_PRIMITIVE_VALUES = {
    "string": "example",
    "integer": 1,
    "number": 1.5,
    "boolean": True,
    "object": {},
    "array": [],
    "null": None,
}


def _resolve_value(doc: Any, schema: Any, depth: int, seen: tuple[str, ...] = ()) -> Any:
    resolved, chain, cyclic = resolve(doc, schema, seen)
    if cyclic or resolved.external or resolved.broken or depth > 8:
        return None
    schema = resolved.value
    if not isinstance(schema, dict):
        return {}
    if "enum" in schema and schema["enum"]:
        return schema["enum"][0]
    typ = schema.get("type")
    if isinstance(typ, list):
        typ = next((item for item in typ if item != "null"), typ[0] if typ else None)
    if typ == "object" or ("properties" in schema and typ is None):
        result = {}
        for name, prop in (schema.get("properties") or {}).items():
            if name in set(schema.get("required") or []):
                result[name] = build_source_example(doc, prop, depth + 1, chain)
        return result
    if typ == "array":
        items = schema.get("items")
        if isinstance(items, dict):
            return [build_source_example(doc, items, depth + 1, chain)]
        return []
    return _PRIMITIVE_VALUES.get(str(typ), "example")


def build_source_example(doc: Any, schema: Any, depth: int = 0, seen: tuple[str, ...] = ()) -> Any:
    return _resolve_value(doc, schema, depth, seen)


MISSING = object()


def disallowed_value(target_schema: Any) -> Any:
    typ = target_schema.get("type") if isinstance(target_schema, dict) else None
    if isinstance(typ, list):
        typ = next((item for item in typ if item != "null"), None)
    if typ == "integer":
        return "not-an-integer"
    if typ == "number":
        return "not-a-number"
    if typ == "boolean":
        return "not-a-boolean"
    if typ == "array":
        return {}
    if typ == "object":
        return []
    if typ == "string":
        return 123
    return "incompatible-value"


def set_nested(target: Any, location: str, value: Any) -> None:
    """Place ``value`` at a semantic JSON path used by failure examples."""
    if not location:
        if isinstance(target, dict) and isinstance(value, dict):
            target.clear()
            target.update(value)
        return
    parts = [part for part in location.split("/") if part]
    cursor: Any = target
    for index, part in enumerate(parts):
        last = index == len(parts) - 1
        if part.isdigit():
            idx = int(part)
            while len(cursor) <= idx:
                cursor.append(None)
            if last:
                cursor[idx] = None if value is MISSING else value
            else:
                if not isinstance(cursor[idx], (dict, list)):
                    cursor[idx] = [] if parts[index + 1].isdigit() else {}
            cursor = cursor[idx]
        else:
            if last:
                if value is MISSING:
                    cursor.pop(part, None)
                else:
                    cursor[part] = value
            else:
                if not isinstance(cursor.get(part), (dict, list)):
                    cursor[part] = [] if parts[index + 1].isdigit() else {}
                cursor = cursor[part]
