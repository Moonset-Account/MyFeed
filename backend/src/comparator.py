"""Direction-aware OpenAPI 3.0 replacement compatibility comparator."""
from __future__ import annotations

import json
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Callable

from .models import Finding, OperationReport
from .resolver import resolve
from .sample_builder import MISSING, build_source_example, disallowed_value, set_nested

HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
PRIMITIVE_TYPES = {"string", "number", "integer", "boolean", "object", "array"}
IGNORED_SCHEMA_KEYS = {
    "$ref", "title", "description", "example", "examples", "enum", "type",
    "nullable", "required", "properties", "items",
}
OUT_OF_SCOPE_SCHEMA_KEYS = {
    "format", "default", "multipleOf", "maximum", "exclusiveMaximum", "minimum",
    "exclusiveMinimum", "maxLength", "minLength", "pattern", "maxItems",
    "minItems", "uniqueItems", "maxProperties", "minProperties", "additionalProperties",
    "readOnly", "writeOnly", "allOf", "oneOf", "anyOf", "not",
    "discriminator", "xml", "externalDocs",
}


def escape_pointer(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


@dataclass
class Comparison:
    old: dict[str, Any]
    new: dict[str, Any]
    root_findings: list[Finding] = field(default_factory=list)

    def finding(
        self,
        severity: str,
        kind: str,
        direction: str,
        message: str,
        old_location: str,
        new_location: str,
        *,
        constraint: str = "",
        old_refs: list[str] | None = None,
        new_refs: list[str] | None = None,
        failure_example: dict[str, Any] | None = None,
    ) -> None:
        self.root_findings.append(
            Finding(
                severity=severity,
                kind=kind,
                direction=direction,  # type: ignore[arg-type]
                message=message,
                old_location=old_location,
                new_location=new_location,
                old_ref_chain=old_refs or [],
                new_ref_chain=new_refs or [],
                constraint=constraint,
                failure_example=failure_example,
            )
        )

    def source_for(self, direction: str) -> tuple[dict[str, Any], str, str]:
        return (self.old, "#", "#") if direction == "request" else (self.new, "#", "#")

    def resolve_node(self, doc: dict[str, Any], node: Any, fallback_location: str):
        resolved, chain, cyclic = resolve(doc, node)
        location = resolved.pointer and f"#{resolved.pointer}" or fallback_location
        return resolved.value, location, chain, resolved, cyclic

    def unknown_out_of_scope(
        self,
        direction: str,
        old_value: Any,
        new_value: Any,
        key: str,
        old_location: str,
        new_location: str,
        old_refs: list[str],
        new_refs: list[str],
    ) -> None:
        if old_value == new_value:
            return
        self.finding(
            "unknown",
            "out-of-scope-constraint",
            direction,
            f"约束 {key} 不在本次可判定范围内，无法确认替换后的兼容性。",
            old_location,
            new_location,
            constraint=key,
            old_refs=old_refs,
            new_refs=new_refs,
        )

    def compare_schemas(
        self,
        old_schema: Any,
        new_schema: Any,
        direction: str,
        old_location: str,
        new_location: str,
        *,
        old_refs: list[str] | None = None,
        new_refs: list[str] | None = None,
        old_seen: tuple[str, ...] = (),
        new_seen: tuple[str, ...] = (),
        example_context: Callable[[str, Any], dict[str, Any] | None] | None = None,
        relative_path: str = "",
    ) -> None:
        old_refs = list(old_refs or [])
        new_refs = list(new_refs or [])

        old_resolved_direct, old_chain, old_cycle = resolve(self.old, old_schema, old_seen)
        old_value = old_resolved_direct.value
        old_loc = old_location if old_resolved_direct.external or old_resolved_direct.broken or old_cycle else (
            old_resolved_direct.pointer and f"#{old_resolved_direct.pointer}" or old_location
        )
        old_resolved = old_resolved_direct
        new_refs_for_child = list(old_chain[len(old_seen):])
        if new_refs_for_child:
            old_refs = old_refs + new_refs_for_child
        new_resolved_direct, new_chain, new_cycle = resolve(self.new, new_schema, new_seen)
        new_value = new_resolved_direct.value
        new_loc = new_location if new_resolved_direct.external or new_resolved_direct.broken or new_cycle else (
            new_resolved_direct.pointer and f"#{new_resolved_direct.pointer}" or new_location
        )
        new_resolved = new_resolved_direct
        added_new_refs = list(new_chain[len(new_seen):])
        if added_new_refs:
            new_refs = new_refs + added_new_refs

        if old_cycle or new_cycle:
            self.finding(
                "unknown",
                "cyclic-schema-reference",
                direction,
                "本地引用链形成循环；工具不展开循环约束。",
                old_loc,
                new_loc,
                constraint="$ref cycle",
                old_refs=old_refs,
                new_refs=new_refs,
            )
            return
        if old_resolved.external or new_resolved.external:
            self.finding(
                "unknown",
                "external-schema-reference",
                direction,
                "存在外部 $ref；离线审查不会联网补全外部 schema。",
                old_loc,
                new_loc,
                constraint="external $ref",
                old_refs=old_refs,
                new_refs=new_refs,
            )
            return
        if old_resolved.broken or new_resolved.broken:
            self.finding(
                "unknown",
                "broken-schema-reference",
                direction,
                "本地 $ref 指向缺失节点，无法确定实际约束。",
                old_loc,
                new_loc,
                constraint="broken $ref",
                old_refs=old_refs,
                new_refs=new_refs,
            )
            return
        if not isinstance(old_value, dict) or not isinstance(new_value, dict):
            if stable_json(old_value) != stable_json(new_value):
                self.finding(
                    "unknown",
                    "unsupported-schema-form",
                    direction,
                    "存在非对象 schema 形式，当前工具无法完整解释。",
                    old_loc,
                    new_loc,
                    old_refs=old_refs,
                    new_refs=new_refs,
                )
            return

        # Required and $ref can coexist in vendor extensions, but standard $ref
        # siblings are annotation-only in OpenAPI 3.0. We still inspect object
        # constraints after resolving the target.
        for key in sorted(set(old_value) | set(new_value)):
            if key in IGNORED_SCHEMA_KEYS or key.startswith("x-"):
                continue
            self.unknown_out_of_scope(
                direction,
                old_value.get(key),
                new_value.get(key),
                key,
                f"{old_loc}/{escape_pointer(key)}",
                f"{new_loc}/{escape_pointer(key)}",
                old_refs,
                new_refs,
            )

        if direction == "request":
            source_schema, source_doc, source_loc_value = old_value, self.old, old_loc
            target_schema = new_value
            source_refs, target_refs = old_refs, new_refs
        else:
            source_schema, source_doc, source_loc_value = new_value, self.new, new_loc
            target_schema = old_value
            source_refs, target_refs = new_refs, old_refs

        self._compare_required(
            old_value, new_value, direction, old_loc, new_loc, old_refs, new_refs,
            example_context, relative_path,
        )
        self._compare_enums(
            source_schema, target_schema, direction, old_loc, new_loc, old_refs,
            new_refs, source_doc, source_loc_value, source_refs, target_refs,
            example_context, relative_path,
        )
        self._compare_types(
            old_value, new_value, direction, old_loc, new_loc, old_refs, new_refs,
            source_schema, target_schema, source_doc, source_loc_value,
            example_context, relative_path,
        )
        self._compare_nullable(
            old_value, new_value, direction, old_loc, new_loc, old_refs, new_refs,
            source_schema, target_schema, source_doc, source_loc_value,
            example_context, relative_path,
        )
        self._compare_children(
            old_value, new_value, direction, old_loc, new_loc, old_refs, new_refs,
            old_seen, new_seen, example_context, relative_path,
        )

    def _failure(
        self,
        example_context: Callable[[str, Any], dict[str, Any] | None] | None,
        relative_path: str,
        value: Any,
    ) -> dict[str, Any] | None:
        if example_context is None:
            return None
        return example_context(relative_path, value)

    def _required_names(self, schema: dict[str, Any]) -> set[str]:
        required = schema.get("required")
        if not isinstance(required, list):
            return set()
        return {item for item in required if isinstance(item, str)}

    def _compare_required(
        self, old, new, direction, old_loc, new_loc, old_refs, new_refs,
        example_context, relative_path,
    ) -> None:
        old_required = self._required_names(old)
        new_required = self._required_names(new)
        if direction == "request":
            added = sorted(new_required - old_required)
            removed = sorted(old_required - new_required)
            for name in added:
                self.finding(
                    "breaking",
                    "required-property-added",
                    direction,
                    f"新服务请求新增必填字段 {name}，旧客户端未发送时会被拒绝。",
                    f"{old_loc}/required",
                    f"{new_loc}/required/{list(new.get('required', [])).index(name) if isinstance(new.get('required'), list) else ''}",
                    constraint=f"request body {name} required=true",
                    old_refs=old_refs,
                    new_refs=new_refs,
                    failure_example=self._failure(example_context, f"{relative_path}/{name}", MISSING),
                )
            if removed:
                self.finding(
                    "compatible",
                    "required-property-removed",
                    direction,
                    f"新服务不再要求请求字段：{', '.join(removed)}。",
                    f"{old_loc}/required",
                    f"{new_loc}/required",
                    constraint=f"required removed: {', '.join(removed)}",
                    old_refs=old_refs,
                    new_refs=new_refs,
                )
        else:
            lost = sorted(old_required - new_required)
            gained = sorted(new_required - old_required)
            for name in lost:
                self.finding(
                    "breaking",
                    "required-response-property-removed",
                    direction,
                    f"新服务响应不再保证字段 {name} 必填，旧客户端读取时可能缺失。",
                    f"{old_loc}/required",
                    f"{new_loc}/required",
                    constraint=f"response body {name} required: true -> false",
                    old_refs=old_refs,
                    new_refs=new_refs,
                    failure_example=self._failure(example_context, f"{relative_path}/{name}", MISSING),
                )
            if gained:
                self.finding(
                    "compatible",
                    "required-response-property-added",
                    direction,
                    f"新服务响应额外保证字段必填：{', '.join(gained)}。",
                    f"{old_loc}/required",
                    f"{new_loc}/required",
                    constraint=f"required added: {', '.join(gained)}",
                    old_refs=old_refs,
                    new_refs=new_refs,
                )

    def _enum_values(self, schema: dict[str, Any]) -> list[Any] | None:
        if "enum" not in schema:
            return None
        values = schema.get("enum")
        return values if isinstance(values, list) else []

    def _enum_missing_example(self, target: dict[str, Any]) -> Any:
        typ = target.get("type", "string")
        candidates = {
            "string": ["unexpected", "A", "B", "C", "unknown", "x"],
            "integer": [-1, 2, 3, 4, 99],
            "number": [-1.5, 2.5, 9.9],
            "boolean": [True, False],
        }
        allowed = set()
        for value in target.get("enum") or []:
            try:
                allowed.add(stable_json(value))
            except TypeError:
                pass
        for value in candidates.get(typ, candidates["string"]):  # type: ignore[arg-type]
            if stable_json(value) not in allowed:
                return value
        return "unexpected"

    def _compare_enums(
        self, source, target, direction, old_loc, new_loc, old_refs, new_refs,
        source_doc, source_loc, source_refs, target_refs, example_context, relative_path,
    ) -> None:
        source_values = self._enum_values(source)
        target_values = self._enum_values(target)
        if source_values is None and target_values is None:
            return
        target_set = {stable_json(value): value for value in (target_values or [])}
        if source_values is None and target_values is not None:
            value = self._enum_missing_example(target)
            message = (
                "新服务把旧契约未限制的请求值收窄为枚举，存在合法旧请求无法通过。"
                if direction == "request"
                else "新服务移除旧契约的枚举保证，可能返回旧客户端枚举之外的值。"
            )
            kind = "request-enum-added" if direction == "request" else "response-enum-removed"
            self.finding(
                "breaking",
                kind,
                direction,
                message,
                old_loc,
                new_loc,
                constraint=f"enum absent -> {target_values}",
                old_refs=old_refs,
                new_refs=new_refs,
                failure_example=self._failure(example_context, relative_path, value),
            )
            return
        if target_values is None and source_values is not None:
            self.finding(
                "compatible",
                "enum-constraint-relaxed-or-subset",
                direction,
                "请求取消枚举限制不会拒绝旧请求。" if direction == "request"
                else "新服务枚举是旧契约未限制值域的子集，不构成扩大枚举。",
                old_loc,
                new_loc,
                constraint="enum constraint target absent",
                old_refs=old_refs,
                new_refs=new_refs,
            )
            return
        for value in source_values:
            if stable_json(value) not in target_set:
                kind = "request-enum-value-removed" if direction == "request" else "response-enum-value-added"
                message = (
                    f"新服务请求不再接受枚举值 {stable_json(value)}。"
                    if direction == "request"
                    else f"新服务响应可能返回旧客户端枚举之外的值 {stable_json(value)}。"
                )
                self.finding(
                    "breaking",
                    kind,
                    direction,
                    message,
                    old_loc,
                    new_loc,
                    constraint=f"enum value {stable_json(value)}",
                    old_refs=old_refs,
                    new_refs=new_refs,
                    failure_example=self._failure(example_context, relative_path, value),
                )

    def _normal_type(self, schema: dict[str, Any]) -> str | None:
        typ = schema.get("type")
        if isinstance(typ, list):
            non_null = [item for item in typ if item != "null"]
            if len(non_null) == 1:
                return non_null[0]
            return "union" if non_null else None
        if isinstance(typ, str):
            return typ
        return None

    def _types_compatible(self, source_type: str | None, target_type: str | None) -> bool:
        if source_type is None or target_type is None:
            return target_type is None
        if source_type == target_type:
            return True
        # JSON integer values are a subset of number in both directions of the
        # replacement contract only when moving integer -> number (source target
        # relation); number -> integer is checked below by source/target order.
        return {source_type, target_type} == {"integer", "number"} and (
            source_type == "integer" and target_type == "number"
        )

    def _compare_types(
        self, old, new, direction, old_loc, new_loc, old_refs, new_refs,
        source, target, source_doc, source_loc, example_context, relative_path,
    ) -> None:
        old_type = self._normal_type(old)
        new_type = self._normal_type(new)
        source_type = old_type if direction == "request" else new_type
        target_type = new_type if direction == "request" else old_type
        if old.get("type") == new.get("type") and old_type == new_type:
            return
        compatible = self._types_compatible(source_type, target_type)
        if compatible:
            return
        source_example = build_source_example(source_doc, source)
        value = disallowed_value(target)
        # If type is a normal cross-type change, use a valid source-shaped value.
        if source_type in PRIMITIVE_TYPES and target_type in PRIMITIVE_TYPES:
            from .sample_builder import _PRIMITIVE_VALUES
            value = _PRIMITIVE_VALUES.get(source_type, source_example)
        message = (
            f"请求类型由 {source_type or '未声明'} 收窄为 {target_type or '未声明'}，旧请求值可能不合法。"
            if direction == "request"
            else f"响应类型从旧契约的 {target_type or '未声明'} 变为新服务的 {source_type or '未声明'}，旧客户端预期可能无法读取。"
        )
        self.finding(
            "breaking",
            "schema-type-incompatible",
            direction,
            message,
            f"{old_loc}/type" if "type" in old else old_loc,
            f"{new_loc}/type" if "type" in new else new_loc,
            constraint=f"type {source_type or 'any'} -> {target_type or 'any'}",
            old_refs=old_refs,
            new_refs=new_refs,
            failure_example=self._failure(example_context, relative_path, value),
        )

    def _compare_nullable(
        self, old, new, direction, old_loc, new_loc, old_refs, new_refs,
        source, target, source_doc, source_loc, example_context, relative_path,
    ) -> None:
        old_nullable = bool(old.get("nullable", False))
        new_nullable = bool(new.get("nullable", False))
        source_nullable = old_nullable if direction == "request" else new_nullable
        target_nullable = new_nullable if direction == "request" else old_nullable
        if source_nullable and not target_nullable:
            self.finding(
                "breaking",
                "nullable-removed",
                direction,
                "请求不再允许 null。" if direction == "request" else "新服务响应可能返回 null，但旧契约不允许。",
                f"{old_loc}/nullable",
                f"{new_loc}/nullable",
                constraint=f"nullable {source_nullable} -> {target_nullable}",
                old_refs=old_refs,
                new_refs=new_refs,
                failure_example=self._failure(example_context, relative_path, None),
            )

    def _compare_children(
        self, old, new, direction, old_loc, new_loc, old_refs, new_refs,
        old_seen, new_seen, example_context, relative_path,
    ) -> None:
        old_props = old.get("properties") if isinstance(old.get("properties"), dict) else {}
        new_props = new.get("properties") if isinstance(new.get("properties"), dict) else {}
        for name in sorted(set(old_props) | set(new_props)):
            child_relative = f"{relative_path}/{escape_pointer(name)}"
            if name in old_props and name in new_props:
                self.compare_schemas(
                    old_props[name], new_props[name], direction,
                    f"{old_loc}/properties/{escape_pointer(name)}",
                    f"{new_loc}/properties/{escape_pointer(name)}",
                    old_refs=old_refs, new_refs=new_refs,
                    old_seen=tuple(old_refs), new_seen=tuple(new_refs),
                    example_context=example_context, relative_path=child_relative,
                )
            elif direction == "request" and name not in new_props:
                # Sending an ignored property is not represented as a guarantee.
                pass
            elif direction == "response" and name not in old_props:
                # Additional response fields do not invalidate old readers.
                pass
        old_items = old.get("items")
        new_items = new.get("items")
        child_relative = f"{relative_path}/0" if relative_path else "0"
        if isinstance(old_items, dict) and isinstance(new_items, dict):
            self.compare_schemas(
                old_items, new_items, direction,
                f"{old_loc}/items", f"{new_loc}/items",
                old_refs=old_refs, new_refs=new_refs,
                old_seen=tuple(old_refs), new_seen=tuple(new_refs),
                example_context=example_context,
                relative_path=child_relative,
            )
        elif direction == "request" and isinstance(new_items, dict):
            self.compare_schemas(
                {}, new_items, direction,
                f"{old_loc}/items", f"{new_loc}/items",
                old_refs=old_refs, new_refs=new_refs,
                old_seen=tuple(old_refs), new_seen=tuple(new_refs),
                example_context=example_context,
                relative_path=child_relative,
            )
        elif direction == "response" and isinstance(old_items, dict):
            self.compare_schemas(
                old_items, {}, direction,
                f"{old_loc}/items", f"{new_loc}/items",
                old_refs=old_refs, new_refs=new_refs,
                old_seen=tuple(old_refs), new_seen=tuple(new_refs),
                example_context=example_context,
                relative_path=child_relative,
            )

    def _resolve_local(self, doc: Any, node: Any, location: str):
        value, actual_location, chain, resolved, cyclic = self.resolve_node(doc, node, location)
        if resolved.external or resolved.broken or cyclic:
            return value, location, chain, True
        return value, actual_location, chain, False

    def _param_key(self, parameter: dict[str, Any]) -> tuple[str, str]:
        return str(parameter.get("in", "")), str(parameter.get("name", ""))

    def _merged_parameters(self, path_item: dict[str, Any], operation: dict[str, Any], doc: Any, base: str):
        merged: dict[tuple[str, str], tuple[Any, str, bool]] = OrderedDict()
        for source in (path_item, operation):
            for index, param in enumerate(source.get("parameters") or []):
                value, loc, _, bad = self._resolve_local(
                    doc, param, f"{base}/parameters/{index}"
                )
                key = self._param_key(value) if isinstance(value, dict) else ("unresolved", str(index))
                merged[key] = value, loc, bad
        return list(merged.items())

    def _parameter_example(self, parameter: dict[str, Any], value: Any) -> dict[str, Any]:
        return {
            "kind": "old-request" if parameter.get("in") != "header" else "old-request",
            "request": {
                "parameters": [] if value is MISSING else [
                    {"name": parameter.get("name"), "in": parameter.get("in"), "value": value}
                ]
            },
        }

    def _compare_parameter(self, old_param, new_param, old_loc, new_loc):
        for key in ("style", "explode", "allowEmptyValue", "allowReserved", "content", "examples"):
            if key in old_param or key in new_param:
                self.unknown_out_of_scope(
                    "request", old_param.get(key), new_param.get(key), key,
                    f"{old_loc}/{key}", f"{new_loc}/{key}", [], [],
                )
        old_required = bool(old_param.get("required", False))
        new_required = bool(new_param.get("required", False))
        if not old_required and new_required:
            self.finding(
                "breaking",
                "required-parameter-added",
                "request",
                f"新服务新增必填 {old_param.get('in', 'parameter')} 参数 {new_param.get('name')}。",
                f"{old_loc}/required", f"{new_loc}/required",
                constraint=f"parameter {new_param.get('name')} required=true",
                failure_example=self._parameter_example(new_param, MISSING)
            )
        elif old_required and not new_required:
            self.finding(
                "compatible",
                "required-parameter-relaxed",
                "request",
                f"参数 {old_param.get('name')} 不再必填。",
                f"{old_loc}/required", f"{new_loc}/required",
                constraint=f"parameter {old_param.get('name')} required=false",
            )
        old_schema = old_param.get("schema")
        new_schema = new_param.get("schema")
        old_schema_present = isinstance(old_schema, dict)
        new_schema_present = isinstance(new_schema, dict)
        old_schema, old_schema_loc, old_chain, old_bad = self._resolve_local(
            self.old, old_schema if old_schema_present else {}, f"{old_loc}/schema"
        )
        new_schema, new_schema_loc, new_chain, new_bad = self._resolve_local(
            self.new, new_schema if new_schema_present else {}, f"{new_loc}/schema"
        )
        if old_bad or new_bad:
            self.finding(
                "unknown", "parameter-reference-unresolved", "request",
                "参数 schema 引用无法离线确定。", old_schema_loc, new_schema_loc,
                constraint="$ref", old_refs=old_chain, new_refs=new_chain,
            )
            return
        if old_schema_present or new_schema_present:
            self.compare_schemas(
                old_schema if old_schema_present else {},
                new_schema if new_schema_present else {},
                "request", old_schema_loc, new_schema_loc,
                old_refs=old_chain, new_refs=new_chain,
                example_context=lambda _path, value, p=new_param: self._parameter_example(p, value),
            )

    def _compare_parameters(self, path, method, old_path, new_path, old_op, new_op):
        base_old = f"#/paths/{escape_pointer(path)}/{method}"
        base_new = f"#/paths/{escape_pointer(path)}/{method}"
        old_params = self._merged_parameters(old_path, old_op, self.old, base_old)
        new_params = self._merged_parameters(new_path, new_op, self.new, base_new)
        new_by_key = {key: value for key, value in new_params}
        old_by_key = {key: value for key, value in old_params}
        for key, (old_param, old_loc, old_bad) in old_by_key.items():
            if key not in new_by_key:
                if old_bad:
                    self.finding(
                        "unknown", "parameter-reference-unresolved", "request",
                        "旧参数引用无法离线解析，不能确定删除或放宽该参数是否兼容。",
                        old_loc, "#", constraint="parameter $ref",
                    )
                # Concrete old query/header parameters that disappear are not
                # treated as rejected old requests under the stated rules.
                continue
            new_param, new_loc, new_bad = new_by_key[key]
            if old_bad or new_bad:
                self.finding(
                    "unknown", "parameter-reference-unresolved", "request",
                    "参数 $ref 无法离线解析。", old_loc, new_loc, constraint="parameter $ref",
                )
                continue
            self._compare_parameter(old_param, new_param, old_loc, new_loc)
        for key, (new_param, new_loc, new_bad) in new_by_key.items():
            if key in old_by_key:
                continue
            if new_bad:
                self.finding(
                    "unknown", "parameter-reference-unresolved", "request",
                    "新参数引用无法离线解析，不能确定旧请求是否缺少必填约束。",
                    "#", new_loc, constraint="parameter $ref",
                )
                continue
            required = bool(new_param.get("required", False))
            if key[0] == "path" or required:
                self.finding(
                    "breaking",
                    "parameter-added",
                    "request",
                    f"新服务要求提供参数 {new_param.get('name')}。",
                    "#", f"{new_loc}/required",
                    constraint=f"parameter {new_param.get('name')} required={required}",
                    failure_example=self._parameter_example(new_param, MISSING)
                )

    def _json_content_types(self, content: dict[str, Any]) -> list[str]:
        result = []
        for media_type in content:
            base_type = media_type.split(";", 1)[0].strip().lower()
            if base_type == "application/json" or base_type.endswith("+json"):
                result.append(media_type)
        return sorted(result)

    def _request_failure(self, schema_doc: Any, schema: dict[str, Any], path: str, value: Any):
        root = build_source_example(schema_doc, schema)
        if not isinstance(root, (dict, list)):
            body = {} if value is MISSING else value
            return {"kind": "old-request", "request": {"body": body}}
        set_nested(root, path, value)
        return {"kind": "old-request", "request": {"body": root}}

    def _response_failure(self, schema_doc: Any, schema: dict[str, Any], path: str, value: Any, status: str):
        root = build_source_example(schema_doc, schema)
        if isinstance(root, (dict, list)):
            set_nested(root, path, value)
            payload = root
        else:
            payload = {} if value is MISSING else value
        return {"kind": "new-response", "response": {"statusCode": status, "body": payload}}

    def _compare_content_schema(
        self, old_media, new_media, direction, old_loc, new_loc, status: str | None = None
    ):
        old_content = old_media.get("content") if isinstance(old_media, dict) else None
        new_content = new_media.get("content") if isinstance(new_media, dict) else None
        old_content = old_content if isinstance(old_content, dict) else {}
        new_content = new_content if isinstance(new_content, dict) else {}
        old_json = self._json_content_types(old_content)
        new_json = self._json_content_types(new_content)
        common = sorted(set(old_json) & set(new_json))
        if common:
            for media_type in common:
                old_media = old_content.get(media_type) or {}
                new_media = new_content.get(media_type) or {}
                old_schema = old_media.get("schema") or {}
                new_schema = new_media.get("schema") or {}
                old_schema_loc = f"{old_loc}/content/{escape_pointer(media_type)}/schema"
                new_schema_loc = f"{new_loc}/content/{escape_pointer(media_type)}/schema"
                if direction == "request":
                    example_context = lambda path, value, doc=self.old, schema=old_schema: self._request_failure(
                        doc, schema if isinstance(schema, dict) else {}, path, value
                    )
                else:
                    example_context = lambda path, value, doc=self.new, schema=new_schema, st=status or "default": self._response_failure(
                        doc, schema if isinstance(schema, dict) else {}, path, value, st
                    )
                self.compare_schemas(
                    old_schema, new_schema, direction, old_schema_loc, new_schema_loc,
                    example_context=example_context,
                )
            return bool(common), common
        if old_json and not new_json:
            self.finding(
                "breaking", "json-content-removed", direction,
                "新服务不再提供旧契约使用的 JSON 表达。" if direction == "response"
                else "新服务不再接受旧请求使用的 JSON 媒体类型。",
                old_loc, new_loc, constraint="application/json content",
            )
        elif new_json and not old_json and direction == "response":
            self.finding(
                "breaking", "response-content-type-added",
                "response", "新服务缺少旧契约对应 JSON 媒体类型，无法保证旧响应读取方式。",
                old_loc, new_loc, constraint="response media type",
            )
        elif (old_content or new_content) and not common:
            self.finding(
                "unknown", "non-json-content-unsupported", direction,
                "非 JSON 媒体类型不在当前可判定范围。",
                old_loc, new_loc, constraint="media type",
            )
        return False, common

    def _compare_request_body(self, path, method, old_op, new_op):
        old_body = old_op.get("requestBody")
        new_body = new_op.get("requestBody")
        old_loc = f"#/paths/{escape_pointer(path)}/{method}/requestBody"
        new_loc = f"#/paths/{escape_pointer(path)}/{method}/requestBody"
        if isinstance(old_body, dict) and isinstance(old_body.get("$ref"), str):
            old_body, old_loc, _, old_body_bad = self._resolve_local(self.old, old_body, old_loc)
        else:
            old_body_bad = False
        if isinstance(new_body, dict) and isinstance(new_body.get("$ref"), str):
            new_body, new_loc, _, new_body_bad = self._resolve_local(self.new, new_body, new_loc)
        else:
            new_body_bad = False
        if old_body_bad or new_body_bad:
            self.finding(
                "unknown", "request-body-reference-unresolved", "request",
                "请求体 $ref 无法在本地完整解析。", old_loc, new_loc, constraint="requestBody $ref",
            )
            return
        if not isinstance(old_body, dict) and not isinstance(new_body, dict):
            return
        if isinstance(new_body, dict) and not isinstance(old_body, dict):
            if new_body.get("required", False):
                self.finding(
                    "breaking", "request-body-added", "request",
                    "新服务新增必填请求体。", "#", new_loc,
                    constraint="requestBody required=true",
                    failure_example={"kind": "old-request", "request": {"body": {}}},
                )
            return
        if isinstance(old_body, dict) and not isinstance(new_body, dict):
            if old_body.get("required", False):
                self.finding(
                    "breaking", "request-body-removed", "request",
                    "新服务不再接受旧客户端发送的请求体。", old_loc, "#",
                    constraint="requestBody present -> absent",
                )
            return
        old_required = bool(old_body.get("required", False))  # type: ignore[union-attr]
        new_required = bool(new_body.get("required", False))  # type: ignore[union-attr]
        if not old_required and new_required:
            self.finding(
                "breaking", "request-body-required", "request",
                "请求体从可选变为必填。", f"{old_loc}/required", f"{new_loc}/required",
                constraint="requestBody required: false -> true",
                failure_example={"kind": "old-request", "request": {"body": {}}},
            )
        self._compare_content_schema(old_body, new_body, "request", old_loc, new_loc)

    def _compare_header(self, name, old_header, new_header, status, old_loc, new_loc):
        old_schema = old_header.get("schema", {}) if isinstance(old_header, dict) else {}
        new_schema = new_header.get("schema", {}) if isinstance(new_header, dict) else {}
        old_required = bool(old_header.get("required", False)) if isinstance(old_header, dict) else False
        new_required = bool(new_header.get("required", False)) if isinstance(new_header, dict) else False
        if old_required and not new_required:
            self.finding(
                "breaking", "response-header-required-removed", "response",
                f"新服务响应不再保证必填响应头 {name}。",
                old_loc, new_loc, constraint=f"response header {name} required: true -> false",
            )
        self.compare_schemas(
            old_schema, new_schema, "response",
            f"{old_loc}/schema", f"{new_loc}/schema",
            example_context=lambda path, value: {
                "kind": "new-response",
                "response": {
                    "statusCode": status,
                    "headers": {} if value is MISSING else {name: value},
                },
            },
        )

    def _resolve_response(self, doc, response, location):
        if isinstance(response, dict) and isinstance(response.get("$ref"), str):
            return self._resolve_local(doc, response, location)
        return response, location, [], False

    def _compare_responses(self, path, method, old_op, new_op):
        old_responses = old_op.get("responses") if isinstance(old_op.get("responses"), dict) else {}
        new_responses = new_op.get("responses") if isinstance(new_op.get("responses"), dict) else {}
        old_base = f"#/paths/{escape_pointer(path)}/{method}/responses"
        new_base = f"#/paths/{escape_pointer(path)}/{method}/responses"
        for status in sorted(old_responses):
            old_loc = f"{old_base}/{escape_pointer(str(status))}"
            if status not in new_responses:
                self.finding(
                    "breaking", "response-status-removed", "response",
                    f"新服务缺少旧客户端可能处理的响应状态 {status}。",
                    old_loc, "#", constraint=f"response {status} removed",
                    failure_example={"kind": "new-response", "response": {"statusCode": status, "unavailable": True}},
                )
                continue
            new_loc = f"{new_base}/{escape_pointer(str(status))}"
            old_response, old_loc2, _, old_bad = self._resolve_response(self.old, old_responses[status], old_loc)
            new_response, new_loc2, _, new_bad = self._resolve_response(self.new, new_responses[status], new_loc)
            if old_bad or new_bad:
                self.finding(
                    "unknown", "response-reference-unresolved", "response",
                    "响应 $ref 无法离线解析。", old_loc2, new_loc2, constraint="$ref",
                )
                continue
            self._compare_content_schema(
                old_response or {}, new_response or {}, "response", old_loc2, new_loc2, str(status)
            )
            old_headers = old_response.get("headers", {}) if isinstance(old_response, dict) else {}
            new_headers = new_response.get("headers", {}) if isinstance(new_response, dict) else {}
            resolved_old_headers = {}
            resolved_new_headers = {}
            for header_name, header_node in old_headers.items():
                header_value, header_loc, _, header_bad = self._resolve_response(
                    self.old, header_node, f"{old_loc2}/headers/{escape_pointer(str(header_name))}"
                )
                resolved_old_headers[header_name] = (header_value, header_loc, header_bad)
            for header_name, header_node in new_headers.items():
                header_value, header_loc, _, header_bad = self._resolve_response(
                    self.new, header_node, f"{new_loc2}/headers/{escape_pointer(str(header_name))}"
                )
                resolved_new_headers[header_name] = (header_value, header_loc, header_bad)
            for header in sorted(resolved_old_headers):
                old_header, old_header_loc, old_header_bad = resolved_old_headers[header]
                if header not in resolved_new_headers:
                    if isinstance(old_header, dict) and old_header.get("required", False):
                        self.finding(
                            "breaking", "response-header-removed", "response",
                            f"新服务缺少旧契约保证的响应头 {header}。",
                            old_header_loc, "#",
                            constraint=f"response header {header} removed",
                        )
                else:
                    new_header, new_header_loc, new_header_bad = resolved_new_headers[header]
                    if old_header_bad or new_header_bad:
                        self.finding(
                            "unknown", "response-header-reference-unresolved", "response",
                            "响应头 $ref 无法离线解析。", old_header_loc, new_header_loc,
                            constraint="$ref",
                        )
                    else:
                        self._compare_header(
                            header, old_header or {}, new_header or {}, str(status),
                            old_header_loc, new_header_loc,
                        )
        for status in sorted(new_responses):
            if status not in old_responses:
                self.finding(
                    "breaking", "response-status-added", "response",
                    f"新服务新增旧契约未声明的响应状态 {status}，旧客户端可能没有处理。",
                    "#", f"{new_base}/{escape_pointer(str(status))}",
                    constraint=f"response {status} added",
                    failure_example={"kind": "new-response", "response": {"statusCode": status, "body": {}}},
                )

    def _operation(self, path_item: dict[str, Any], method: str) -> dict[str, Any]:
        value, _, _, bad = self._resolve_local(self.old, path_item.get(method, {}), "")
        return value if isinstance(value, dict) else {}

    def compare(self) -> dict[str, Any]:
        old_paths = self.old.get("paths") if isinstance(self.old.get("paths"), dict) else {}
        new_paths = self.new.get("paths") if isinstance(self.new.get("paths"), dict) else {}
        operations: list[OperationReport] = []

        for path in sorted(set(old_paths) | set(new_paths)):
            before = len(self.root_findings)
            old_path_location = f"#/paths/{escape_pointer(path)}"
            new_path_location = f"#/paths/{escape_pointer(path)}"
            old_path_item, old_path_loc, _, old_path_bad = self._resolve_local(
                self.old, old_paths.get(path, {}), old_path_location
            )
            new_path_item, new_path_loc, _, new_path_bad = self._resolve_local(
                self.new, new_paths.get(path, {}), new_path_location
            )
            if old_path_bad or new_path_bad or not isinstance(old_path_item, dict) or not isinstance(new_path_item, dict):
                self.finding(
                    "unknown",
                    "path-reference-unresolved",
                    "request",
                    "路径级 $ref 无法在本地完整解析，不能确认该路径下的方法集合。",
                    old_path_loc,
                    new_path_loc,
                    constraint="path item $ref",
                )
                operations.append(OperationReport(path, "*", None, None, self.root_findings[before:]))
                continue
            if path not in new_paths:
                for method in sorted(HTTP_METHODS.intersection(old_path_item.keys())):
                    before = len(self.root_findings)
                    report = OperationReport(
                        path=path, method=method,
                        old_operation_id=old_path_item.get(method, {}).get("operationId"),
                        new_operation_id=None,
                        findings=[],
                    )
                    self.finding(
                        "breaking", "operation-removed", "request",
                        f"新服务缺少旧接口 {method.upper()} {path}。",
                        f"#/paths/{escape_pointer(path)}/{method}", "#",
                        constraint="operation removed",
                        failure_example={
                            "kind": "old-request",
                            "request": {"method": method.upper(), "path": path, "unavailable": True},
                        },
                    )
                    report.findings = self.root_findings[before:]
                    operations.append(report)
                continue
            if path not in old_paths:
                for method in sorted(HTTP_METHODS.intersection(new_path_item.keys())):
                    new_op, _, _, _ = self._resolve_local(
                        self.new, new_path_item[method], f"{new_path_loc}/{method}"
                    )
                    operations.append(OperationReport(
                        path=path, method=method,
                        old_operation_id=None,
                        new_operation_id=new_op.get("operationId") if isinstance(new_op, dict) else None,
                        findings=[],
                    ))
                continue
            for method in sorted(HTTP_METHODS.intersection(set(old_path_item) | set(new_path_item))):
                before = len(self.root_findings)
                if method not in new_path_item:
                    self.finding(
                        "breaking", "operation-removed", "request",
                        f"新服务缺少旧接口 {method.upper()} {path}。",
                        f"#/paths/{escape_pointer(path)}/{method}", "#",
                        constraint="operation removed",
                        failure_example={
                            "kind": "old-request",
                            "request": {"method": method.upper(), "path": path, "unavailable": True},
                        },
                    )
                    old_op = {}
                    new_op = {}
                elif method not in old_path_item:
                    old_op = {}
                    new_op, _, _, new_op_bad = self._resolve_local(
                        self.new, new_path_item[method], f"{new_path_loc}/{method}"
                    )
                    if new_op_bad:
                        self.finding(
                            "unknown", "operation-reference-unresolved", "request",
                            "新增操作的外部或损坏 $ref 无法离线确认。",
                            "#", f"{new_path_loc}/{method}", constraint="operation $ref",
                        )
                        new_op = {}
                else:
                    old_op, _, _, old_op_bad = self._resolve_local(
                        self.old, old_path_item[method], f"{old_path_loc}/{method}"
                    )
                    new_op, _, _, new_op_bad = self._resolve_local(
                        self.new, new_path_item[method], f"{new_path_loc}/{method}"
                    )
                    if old_op_bad or new_op_bad:
                        self.finding(
                            "unknown", "operation-reference-unresolved", "request",
                            "操作级 $ref 无法在本地完整解析。",
                            f"{old_path_loc}/{method}", f"{new_path_loc}/{method}",
                            constraint="operation $ref",
                        )
                    if isinstance(old_op, dict) and isinstance(new_op, dict) and not (old_op_bad or new_op_bad):
                        self._compare_parameters(path, method, old_path_item, new_path_item, old_op, new_op)
                        self._compare_request_body(path, method, old_op, new_op)
                        self._compare_responses(path, method, old_op, new_op)
                report = OperationReport(
                    path=path, method=method,
                    old_operation_id=old_op.get("operationId") if isinstance(old_op, dict) else None,
                    new_operation_id=new_op.get("operationId") if isinstance(new_op, dict) else None,
                    findings=self.root_findings[before:],
                )
                operations.append(report)

        counts = {"compatible": 0, "breaking": 0, "unknown": 0}
        for report in operations:
            counts[report.severity] += 1
        return {
            "summary": {
                "total": len(operations),
                "compatible": counts["compatible"],
                "breaking": counts["breaking"],
                "unknown": counts["unknown"],
            },
            "operations": [item.to_dict() for item in operations],
        }


def validate_openapi(doc: Any, label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(doc, dict):
        return [f"{label} 必须是 JSON 对象。"]
    version = doc.get("openapi")
    if not isinstance(version, str) or not version.startswith("3.0"):
        errors.append(f"{label} 必须声明 OpenAPI 3.0.x（当前为 {version!r}）。")
    if not isinstance(doc.get("paths"), dict):
        errors.append(f"{label} 缺少对象类型的 paths。")
    return errors


def compare_documents(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    return Comparison(old=old, new=new).compare()
