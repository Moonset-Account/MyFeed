"""Local OpenAPI 3.0 reference resolution.

The resolver deliberately never accesses the network. External refs are kept
as unresolved references so the comparator can report them as unknown.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import unquote


@dataclass(frozen=True)
class Resolved:
    value: Any
    pointer: str
    external: bool = False
    broken: bool = False


def _walk_pointer(doc: Any, pointer: str) -> Any:
    if pointer == "":
        return doc
    node: Any = doc
    for raw_part in pointer.lstrip("/").split("/"):
        part = unquote(raw_part.replace("~1", "/").replace("~0", "~"))
        if isinstance(node, list):
            try:
                node = node[int(part)]
            except (ValueError, IndexError):
                return _MISSING
        elif isinstance(node, dict) and part in node:
            node = node[part]
        else:
            return _MISSING
    return node


_MISSING = object()


def parse_ref(ref: str) -> tuple[str, str]:
    """Return ``(document-url-or-empty, json-pointer)`` for a $ref."""
    if "#" not in ref:
        return ref, ""
    target, pointer = ref.split("#", 1)
    return target, pointer


def resolve(doc: Any, node: Any, seen: tuple[str, ...] = ()) -> tuple[Resolved, tuple[str, ...], bool]:
    """Resolve a local chain starting at ``node``.

    Returns the resolved value, the local reference chain, and whether a cycle
    was encountered. A broken/external reference terminates resolution and is
    represented on :class:`Resolved`.
    """
    current = node
    pointer = ""
    chain = seen
    while isinstance(current, dict) and isinstance(current.get("$ref"), str):
        ref = current["$ref"]
        target, pointer = parse_ref(ref)
        if target:
            return Resolved(current, pointer, external=True), chain + (ref,), False
        if ref in chain:
            return Resolved(current, pointer), chain + (ref,), True
        chain = chain + (ref,)
        value = _walk_pointer(doc, pointer)
        if value is _MISSING:
            return Resolved(current, pointer, broken=True), chain, False
        current = value
    return Resolved(current, pointer), chain, False
