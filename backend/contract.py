"""Offline OpenAPI 3.0 replacement compatibility checker.

The direction matters. For requests, the old client's previously valid input
must remain accepted by the new service. For responses, the new service's
output must keep the guarantees that old clients relied on.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Literal
from urllib.parse import unquote

Status = Literal["compatible", "breaking", "unknown"]
Direction = Literal["request", "response"]

HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
JSON_TYPES = {"object", "array", "string", "number", "integer", "boolean", "null"}
IGNORED_KEYS = {
    "title",
    "description",
    "example",
    "examples",
    "externalDocs",
    "xml",
    "deprecated",
    "$comment",
}
SUPPORTED_KEYS = {
    "$ref",
    "type",
    "enum",
    "nullable",
    "required",
    "properties",
    "items",
    "nullable",
}
UNKNOWN_KEYWORDS = {
    "format",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "additionalProperties",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "readOnly",
    "writeOnly",
    "discriminator",
    "default",
}


@dataclass
class Finding:
    status: Status
    subject: str
    message: str
    constraint: str
    direction: Direction | str
    old_location: list[str] = field(default_factory=list)
    new_location: list[str] = field(default_factory=list)
    old_reference_chain: list[str] = field(default_factory=list)
    new_reference_chain: list[str] = field(default_factory=list)
    old_sample: Any = None
    new_sample: Any = None
    sample_note: str | None = None
    method: str = ""
    operation_path: str = ""

    def as_dict(self) -> dict[str, Any]:
        data = {
            "status": self.status,
            "subject": self.subject,
            "message": self.message,
            "constraint": self.constraint,
            "direction": self.direction,
            "oldLocation": self.old_location,
            "newLocation": self.new_location,
            "referenceChains": {
                "old": self.old_reference_chain,
                "new": self.new_reference_chain,
            },
        }
        if self.old_sample is not None or self.new_sample is not None:
            data["sample"] = {
                "oldRequest": self.old_sample if self.direction == "request" else None,
                "newResponse": self.new_sample if self.direction == "response" else None,
                "note": self.sample_note,
            }
        return data


class ReferenceError(Exception):
    pass


class SpecNavigator:
    def __init__(self, doc: dict[str, Any]):
        self.doc = doc

    def resolve_ref(self, ref: Any, chain: list[str]) -> tuple[Any, list[str], list[str]]:
        """Resolve one local pointer. Returns schema, extended chain, local path."""
        if not isinstance(ref, str) or not ref:
            raise ReferenceError("无效的 $ref")
        if not ref.startswith("#"):
            raise ReferenceError("外部引用不会联网补全")
        if ref in chain:
            raise ReferenceError("检测到循环引用，递归结构停止展开")
        pointer = ref[1:]
        if not pointer:
            pointer = ""
        elif not pointer.startswith("/"):
            raise ReferenceError("仅支持文档内 JSON Pointer 引用")
        parts = [unescape_pointer(unquote(part)) for part in pointer.split("/")[1:]] if pointer else []
        current: Any = self.doc
        for part in parts:
            if not isinstance(current, dict) or part not in current:
                raise ReferenceError(f"引用目标不存在: {ref}")
            current = current[part]
        return current, chain + [ref], ["#"] + parts


@dataclass
class Ctx:
    old_nav: SpecNavigator
    new_nav: SpecNavigator
    findings: list[Finding]
    operation_path: str
    method: str
    direction: Direction
    base_old: list[str]
    base_new: list[str]
    old_chain: list[str] = field(default_factory=list)
    new_chain: list[str] = field(default_factory=list)
    seen: set[tuple[str, str, Direction, str]] = field(default_factory=set)
    old_root_schema: Any = None
    new_root_schema: Any = None
    schema_path: tuple[str, ...] = ()

    def child(
        self,
        old_chain: list[str] | None = None,
        new_chain: list[str] | None = None,
        schema_path: tuple[str, ...] | None = None,
    ) -> "Ctx":
        return Ctx(
            self.old_nav,
            self.new_nav,
            self.findings,
            self.operation_path,
            self.method,
            self.direction,
            self.base_old,
            self.base_new,
            old_chain if old_chain is not None else list(self.old_chain),
            new_chain if new_chain is not None else list(self.new_chain),
            self.seen,
            self.old_root_schema,
            self.new_root_schema,
            self.schema_path if schema_path is None else schema_path,
        )

    def add(self, finding: Finding) -> None:
        finding.method = self.method
        finding.operation_path = self.operation_path
        self.findings.append(finding)


def unescape_pointer(part: str) -> str:
    return part.replace("~1", "/").replace("~0", "~")


def is_object_schema(schema: Any) -> bool:
    return (
        isinstance(schema, dict)
        and (schema.get("type") == "object" or "properties" in schema or "required" in schema)
    )


def is_array_schema(schema: Any) -> bool:
    return isinstance(schema, dict) and schema.get("type") == "array"


def schema_type(schema: Any) -> str | None:
    if not isinstance(schema, dict):
        return None
    value = schema.get("type")
    if isinstance(value, list):
        # OpenAPI 3.0 uses nullable rather than a type array. Treat this as
        # unsupported instead of silently picking one member.
        return None
    return value if isinstance(value, str) else None


def enum_values(schema: Any) -> list[Any] | None:
    if not isinstance(schema, dict) or "enum" not in schema:
        return None
    value = schema.get("enum")
    return value if isinstance(value, list) else None


def nullable(schema: Any) -> bool:
    return isinstance(schema, dict) and schema.get("nullable") is True


def join_path(*parts: Any) -> list[str]:
    result: list[str] = []
    for part in parts:
        if part is None:
            continue
        if isinstance(part, (list, tuple)):
            result.extend(str(x) for x in part)
        else:
            result.append(str(part))
    return result


def path_text(path: list[str] | tuple[str, ...]) -> str:
    if not path:
        return "#"
    if path and path[0] == "#":
        rest = path[1:]
    else:
        rest = path
    text = "#"
    for part in rest:
        text += "/" + str(part).replace("~", "~0").replace("/", "~1")
    return text


def dereference(nav: SpecNavigator, schema: Any, chain: list[str]) -> tuple[Any, list[str], list[str]]:
    """Follow a local $ref chain. External or cyclic refs remain errors."""
    local_path: list[str] = []
    guard = 0
    while isinstance(schema, dict) and "$ref" in schema:
        target, chain, local_path = nav.resolve_ref(schema["$ref"], chain)
        schema = target
        guard += 1
        if guard > 200:
            raise ReferenceError("引用链过长")
    return schema, chain, local_path


def compare_contracts(old_doc: dict[str, Any], new_doc: dict[str, Any]) -> dict[str, Any]:
    findings: list[Finding] = []
    old_paths = old_doc.get("paths") if isinstance(old_doc, dict) else None
    new_paths = new_doc.get("paths") if isinstance(new_doc, dict) else None
    if not isinstance(old_paths, dict) or not isinstance(new_paths, dict):
        raise ValueError("OpenAPI 文档必须包含对象类型的 paths")

    all_paths = sorted(set(old_paths) | set(new_paths))
    for path in all_paths:
        old_item_raw = old_paths.get(path)
        new_item_raw = new_paths.get(path)
        try:
            old_nav = SpecNavigator(old_doc)
            new_nav = SpecNavigator(new_doc)
            old_item, old_chain, _ = dereference(old_nav, old_item_raw, []) if old_item_raw is not None else ({}, [], [])
            new_item, new_chain, _ = dereference(new_nav, new_item_raw, []) if new_item_raw is not None else ({}, [], [])
        except ReferenceError as exc:
            findings.append(
                Finding(
                    "unknown",
                    f"路径 {path}",
                    f"路径项引用无法分析：{exc}",
                    "$ref",
                    "path",
                    [f"#/paths/{escape_path(path)}"],
                    [f"#/paths/{escape_path(path)}"],
                )
            )
            continue
        compare_path_item(path, old_item, new_item, old_doc, new_doc, findings, old_chain, new_chain, old_nav)

    add_compatible_operations(old_doc, new_doc, findings)
    enrich_operation_context(findings)
    summary = summarize_findings(findings, old_paths, new_paths)
    return {
        "status": summary,
        "summary": summary_counts(findings),
        "operations": group_operations(findings),
        "findings": [f.as_dict() for f in findings],
    }


def escape_path(path: str) -> str:
    return path.replace("~", "~0").replace("/", "~1")


def compare_path_item(
    path: str,
    old_item: Any,
    new_item: Any,
    old_doc: dict[str, Any],
    new_doc: dict[str, Any],
    findings: list[Finding],
    old_path_chain: list[str],
    new_path_chain: list[str],
    old_nav: SpecNavigator | None = None,
) -> None:
    if old_item is None or not isinstance(old_item, dict):
        findings.append(
            Finding(
                "compatible",
                f"GET {path}",
                "新服务新增路径；旧调用方原本不调用它，不构成旧请求回归。",
                "path-exists",
                "operation",
                [],
                [f"#/paths/{escape_path(path)}"],
            )
        )
        return
    if new_item is None or not isinstance(new_item, dict):
        findings.append(
            Finding(
                "breaking",
                f"{path}",
                "新服务移除了旧路径，旧调用会失败。",
                "path-exists",
                "path",
                [f"#/paths/{escape_path(path)}"],
                [],
                old_path_chain,
                new_path_chain,
                make_old_path_request(path),
                None,
            )
        )
        return

    methods = sorted(
        (m for m in set(old_item) | set(new_item) if m.lower() in HTTP_METHODS),
        key=str.lower,
    )
    for method in methods:
        old_op = old_item.get(method.lower()) or old_item.get(method.upper())
        new_op = new_item.get(method.lower()) or new_item.get(method.upper())
        old_common = [p for p in old_item.get("parameters", []) if isinstance(p, dict)]
        new_common = [p for p in new_item.get("parameters", []) if isinstance(p, dict)]
        old_parameters = merge_parameters(old_common, old_op.get("parameters", []) if isinstance(old_op, dict) else [])
        new_parameters = merge_parameters(new_common, new_op.get("parameters", []) if isinstance(new_op, dict) else [])
        compare_operation(
            path, method.upper(), old_op, new_op, old_parameters, new_parameters,
            old_doc, new_doc, findings, old_path_chain, new_path_chain, old_nav or SpecNavigator(old_doc),
        )


def merge_parameters(path_params: list[dict[str, Any]], op_params: Any) -> list[dict[str, Any]]:
    result: dict[tuple[str, str], dict[str, Any]] = {}
    for param in path_params:
        key = (str(param.get("name", "")), str(param.get("in", "query")))
        result[key] = param
    if isinstance(op_params, list):
        for param in op_params:
            if isinstance(param, dict):
                key = (str(param.get("name", "")), str(param.get("in", "query")))
                result[key] = param
    return list(result.values())


def compare_operation(
    path: str,
    method: str,
    old_op: Any,
    new_op: Any,
    old_parameters: list[dict[str, Any]],
    new_parameters: list[dict[str, Any]],
    old_doc: dict[str, Any],
    new_doc: dict[str, Any],
    findings: list[Finding],
    old_path_chain: list[str],
    new_path_chain: list[str],
    old_nav: SpecNavigator | None = None,
) -> None:
    subject = f"{method} {path}"
    old_loc = [f"#/paths/{escape_path(path)}", method.lower()]
    new_loc = [f"#/paths/{escape_path(path)}", method.lower()]

    if not isinstance(old_op, dict):
        findings.append(Finding(
            "compatible", subject, "新服务新增了该方法，旧调用方原本不会调用它；该新增本身不作为回归。",
            "method-exists", "operation", [], new_loc, old_path_chain, new_path_chain,
        ))
        return
    if not isinstance(new_op, dict):
        findings.append(Finding(
            "breaking", subject, "新服务移除了旧方法，旧调用会失败。", "method-exists", "operation",
            old_loc, [], old_path_chain, new_path_chain, make_old_method_request(path, method, old_parameters, nav=old_nav), None,
        ))
        return

    old_nav = SpecNavigator(old_doc)
    new_nav = SpecNavigator(new_doc)
    compare_parameters(old_nav, new_nav, old_parameters, new_parameters, path, method, findings, old_path_chain, new_path_chain)
    compare_request_body(old_nav, new_nav, old_op, new_op, old_parameters, path, method, findings, old_path_chain, new_path_chain)
    compare_responses(old_nav, new_nav, old_op, new_op, path, method, findings, old_path_chain, new_path_chain)


def compare_parameters(
    old_nav: SpecNavigator,
    new_nav: SpecNavigator,
    old_params: list[dict[str, Any]],
    new_params: list[dict[str, Any]],
    path: str,
    method: str,
    findings: list[Finding],
    old_path_chain: list[str],
    new_path_chain: list[str],
) -> None:
    old_by = {(p.get("name"), p.get("in")): p for p in old_params}
    new_by = {(p.get("name"), p.get("in")): p for p in new_params}
    for key in sorted(old_by.keys(), key=lambda x: tuple(str(v) for v in x)):
        old_param = old_by[key]
        new_param = new_by.get(key)
        name, location = key
        subject = f"{method} {path} 参数 {location}.{name}"
        old_loc = parameter_location(path, method, old_params, name or "", location or "")
        new_loc = parameter_location(path, method, new_params, name or "", location or "")
        try:
            old_resolved, old_chain, old_ref_path = dereference(old_nav, old_param, list(old_path_chain))
        except ReferenceError as exc:
            findings.append(Finding("unknown", subject, f"旧参数引用无法分析：{exc}", "$ref", "request", old_loc, new_loc))
            continue
        try:
            new_resolved, new_chain, new_ref_path = dereference(new_nav, new_param, list(new_path_chain)) if new_param is not None else ({}, [], [])
        except ReferenceError as exc:
            findings.append(Finding("unknown", subject, f"新参数引用无法分析：{exc}", "$ref", "request", old_loc, new_loc))
            continue

        if new_param is None:
            # Removing a parameter generally lets old requests remain valid.
            # If it was path-identifying, operation-level path/method checks have
            # already covered real route removal.
            continue
        if not isinstance(old_resolved, dict) or not isinstance(new_resolved, dict):
            findings.append(Finding("unknown", subject, "参数定义不是可分析的 schema 对象。", "parameter", "request", old_loc, new_loc, old_chain, new_chain))
            continue
        old_required = old_resolved.get("required") is True
        new_required = new_resolved.get("required") is True
        if (not old_required) and new_required:
            sample = make_old_method_request(path, method, old_params, required_param=key, nav=old_nav)
            findings.append(Finding(
                "breaking", subject, "新服务把旧的可选参数改为必填，旧调用不传该参数会失败。",
                "parameter.required", "request",
                join_path(old_loc, "required"), join_path(new_loc, "required"),
                old_chain, new_chain, sample, None,
                "这是一个仍符合旧契约但缺少新必填参数的旧请求。",
            ))
        old_schema = old_resolved.get("schema", {})
        new_schema = new_resolved.get("schema", {})
        ctx = Ctx(
            old_nav, new_nav, findings, path, method, "request",
            join_path(old_loc, "schema"), join_path(new_loc, "schema"),
            old_chain, new_chain, set(), old_schema, new_schema, (str(location), str(name)),
        )
        compare_schema(ctx, old_schema, new_schema, f"参数 {location}.{name}")

    for key, new_param in sorted(new_by.items(), key=lambda kv: tuple(str(v) for v in kv[0])):
        if key in old_by:
            continue
        name, location = key
        try:
            resolved, chain, _ = dereference(new_nav, new_param, list(new_path_chain))
        except ReferenceError as exc:
            findings.append(Finding(
                "unknown", f"{method} {path} 参数 {location}.{name}", f"新参数引用无法分析：{exc}",
                "$ref", "request", [], [f"#/paths/{escape_path(path)}/{method.lower()}/parameters"], list(old_path_chain), list(new_path_chain),
            ))
            continue
        new_loc = parameter_location(path, method, new_params, name or "", location or "")
        if isinstance(resolved, dict) and resolved.get("required") is True:
            findings.append(Finding(
                "breaking", f"{method} {path} 参数 {location}.{name}",
                "新服务新增必填参数，旧调用不会发送该参数。", "parameter.required", "request",
                [], join_path(new_loc, "required"), [], chain,
                make_old_method_request(path, method, old_params, nav=old_nav), None,
                "旧请求未包含新契约要求的参数。",
            ))


def parameter_location(path: str, method: str, params: list[dict[str, Any]], name: str, location: Any) -> list[str]:
    for index, param in enumerate(params):
        if param.get("name") == name and param.get("in") == location:
            return [f"#/paths/{escape_path(path)}", method.lower(), "parameters", str(index)]
    return [f"#/paths/{escape_path(path)}", method.lower(), "parameters"]


def compare_request_body(
    old_nav: SpecNavigator,
    new_nav: SpecNavigator,
    old_op: dict[str, Any],
    new_op: dict[str, Any],
    old_parameters: list[dict[str, Any]],
    path: str,
    method: str,
    findings: list[Finding],
    old_path_chain: list[str],
    new_path_chain: list[str],
) -> None:
    old_body_raw = old_op.get("requestBody")
    new_body_raw = new_op.get("requestBody")
    subject = f"{method} {path} 请求体"
    old_loc = [f"#/paths/{escape_path(path)}", method.lower(), "requestBody"]
    new_loc = [f"#/paths/{escape_path(path)}", method.lower(), "requestBody"]
    try:
        old_body, old_chain, _ = dereference(old_nav, old_body_raw, list(old_path_chain)) if old_body_raw is not None else (None, list(old_path_chain), [])
        new_body, new_chain, _ = dereference(new_nav, new_body_raw, list(new_path_chain)) if new_body_raw is not None else (None, list(new_path_chain), [])
    except ReferenceError as exc:
        findings.append(Finding("unknown", subject, f"请求体引用无法分析：{exc}", "$ref", "request", old_loc if old_body_raw else [], new_loc if new_body_raw else [], old_path_chain, new_path_chain))
        return

    if old_body is None and isinstance(new_body, dict):
        required = new_body.get("required") is True
        media_schema = first_json_schema(new_body.get("content"))
        status: Status = "breaking" if required and media_schema is not None else "unknown"
        msg = "新服务新增必填请求体，旧请求没有请求体。" if status == "breaking" else "新服务新增可选请求体；旧请求通常仍可发送空请求体，但媒体类型/运行时约束需人工确认。"
        findings.append(Finding(status, subject, msg, "requestBody.required", "request", [], join_path(new_loc, "required"), old_chain, new_chain, make_old_method_request(path, method, old_parameters, nav=old_nav), None, "符合旧契约的请求没有请求体。"))
        return
    if isinstance(old_body, dict) and new_body is None:
        return
    if not isinstance(old_body, dict) or not isinstance(new_body, dict):
        return

    if old_body.get("required") is not True and new_body.get("required") is True:
        findings.append(Finding(
            "breaking", subject, "旧请求体可选，新请求体必填；旧客户端可能不发送请求体。",
            "requestBody.required", "request", join_path(old_loc, "required"), join_path(new_loc, "required"),
            old_chain, new_chain, make_old_method_request(path, method, old_parameters, nav=old_nav), None, "该旧请求省略了整个请求体。",
        ))
    compare_content(old_nav, new_nav, old_body.get("content"), new_body.get("content"), path, method, "request", old_loc, new_loc, findings, old_chain, new_chain, subject)


def compare_responses(
    old_nav: SpecNavigator,
    new_nav: SpecNavigator,
    old_op: dict[str, Any],
    new_op: dict[str, Any],
    path: str,
    method: str,
    findings: list[Finding],
    old_path_chain: list[str],
    new_path_chain: list[str],
) -> None:
    old_responses_raw = old_op.get("responses", {})
    new_responses_raw = new_op.get("responses", {})
    try:
        old_responses, old_chain, _ = dereference(old_nav, old_responses_raw, list(old_path_chain))
        new_responses, new_chain, _ = dereference(new_nav, new_responses_raw, list(new_path_chain))
    except ReferenceError as exc:
        findings.append(Finding("unknown", f"{method} {path} 响应", f"响应集合引用无法分析：{exc}", "$ref", "response",
                                [f"#/paths/{escape_path(path)}", method.lower(), "responses"],
                                [f"#/paths/{escape_path(path)}", method.lower(), "responses"], old_path_chain, new_path_chain))
        return
    if not isinstance(old_responses, dict) or not isinstance(new_responses, dict):
        findings.append(Finding("unknown", f"{method} {path} 响应", "responses 必须是对象。", "responses", "response",
                                [f"#/paths/{escape_path(path)}", method.lower(), "responses"],
                                [f"#/paths/{escape_path(path)}", method.lower(), "responses"], old_chain, new_chain))
        return

    for code in sorted(old_responses):
        if code in new_responses:
            continue
        status: Status = "breaking" if is_success_code(code) else "unknown"
        msg = "新服务不再保证旧客户端依赖的成功响应码。" if status == "breaking" else "新服务不再声明旧响应码；该非成功码对调用方是否构成破坏取决于错误处理。"
        findings.append(Finding(status, f"{method} {path} 响应 {code}", msg, "response.status", "response",
                                [f"#/paths/{escape_path(path)}", method.lower(), "responses", str(code)], [], old_chain, new_chain,
                                None, {"statusCode": str(code)} if status == "breaking" else None))

    for code in sorted(new_responses):
        if code in old_responses:
            continue
        # A new response code does not weaken any old response guarantee.
        continue

    for code in sorted(set(old_responses) & set(new_responses)):
        try:
            old_response, old_r_chain, _ = dereference(old_nav, old_responses[code], list(old_chain))
            new_response, new_r_chain, _ = dereference(new_nav, new_responses[code], list(new_chain))
        except ReferenceError as exc:
            findings.append(Finding("unknown", f"{method} {path} 响应 {code}", f"响应引用无法分析：{exc}", "$ref", "response",
                                    [f"#/paths/{escape_path(path)}", method.lower(), "responses", str(code)],
                                    [f"#/paths/{escape_path(path)}", method.lower(), "responses", str(code)], old_chain, new_chain))
            continue
        old_loc = [f"#/paths/{escape_path(path)}", method.lower(), "responses", str(code)]
        new_loc = list(old_loc)
        compare_content(old_nav, new_nav,
                        old_response.get("content") if isinstance(old_response, dict) else None,
                        new_response.get("content") if isinstance(new_response, dict) else None,
                        path, method, "response", old_loc, new_loc, findings, old_r_chain, new_r_chain,
                        f"响应 {code}", str(code))


def is_success_code(code: Any) -> bool:
    return isinstance(code, str) and (code.startswith("2") or code == "default")


def media_score(media: str) -> bool:
    base = media.split(";", 1)[0].strip().lower()
    return base == "application/json" or base.endswith("+json")


def first_json_schema(content: Any) -> tuple[str, Any] | None:
    if not isinstance(content, dict):
        return None
    for media, media_obj in content.items():
        if isinstance(media, str) and media_score(media) and isinstance(media_obj, dict):
            return media, media_obj.get("schema")
    return None


def compare_content(
    old_nav: SpecNavigator,
    new_nav: SpecNavigator,
    old_content: Any,
    new_content: Any,
    path: str,
    method: str,
    direction: Direction,
    old_base: list[str],
    new_base: list[str],
    findings: list[Finding],
    old_chain: list[str],
    new_chain: list[str],
    subject_prefix: str,
    status_code: str | None = None,
) -> None:
    old_json = first_json_schema(old_content)
    new_json = first_json_schema(new_content)
    if old_content and not new_content:
        if direction == "request":
            findings.append(Finding("unknown", f"{method} {path} {subject_prefix}", "旧契约允许请求内容体，新契约未声明请求体；新服务是否忽略该内容无法从文档确定。", "requestBody.content", "request",
                                    join_path(old_base, "content"), [], old_chain, new_chain))
            return
        findings.append(Finding("breaking", f"{method} {path} {subject_prefix}", "新响应不再提供旧响应声明的内容体。", "response.content", "response",
                                join_path(old_base, "content"), [], old_chain, new_chain,
                                None, {"statusCode": status_code, "body": None} if status_code else None))
        return
    if new_content and not old_content:
        if direction == "response":
            return
        findings.append(Finding("unknown", f"{method} {path} {subject_prefix}", "新请求要求内容体但旧契约没有 JSON 请求体；需要人工确认旧请求是否可接受。", "requestBody.content", "request",
                                [], join_path(new_base, "content"), old_chain, new_chain))
        return
    if not old_json or not new_json:
        if old_content or new_content:
            findings.append(Finding("unknown", f"{method} {path} {subject_prefix}", "未找到两侧可比较的 JSON 媒体类型；非 JSON 载荷不在本次范围内。", "content-type", direction,
                                    join_path(old_base, "content") if old_content else [],
                                    join_path(new_base, "content") if new_content else [], old_chain, new_chain))
        return
    old_media, old_schema_raw = old_json
    new_media, new_schema_raw = new_json
    if old_media != new_media:
        findings.append(Finding("unknown", f"{method} {path} {subject_prefix}", f"JSON 媒体类型从 {old_media} 变为 {new_media}，本工具不推断兼容性。", "content-type", direction,
                                join_path(old_base, "content", old_media), join_path(new_base, "content", new_media), old_chain, new_chain))
    ctx = Ctx(old_nav, new_nav, findings, path, method, direction,
              join_path(old_base, "content", old_media, "schema"),
              join_path(new_base, "content", new_media, "schema"),
              old_chain, new_chain, set(), old_schema_raw, new_schema_raw, ())
    if status_code:
        ctx.schema_path = ("statusCode", status_code, "body")
    compare_schema(ctx, old_schema_raw, new_schema_raw, f"{subject_prefix} JSON")


def compare_schema(ctx: Ctx, old_schema_raw: Any, new_schema_raw: Any, subject: str) -> None:
    try:
        old_schema, old_chain, old_ref_local = dereference(ctx.old_nav, old_schema_raw, list(ctx.old_chain))
    except ReferenceError as exc:
        ctx.add(Finding("unknown", subject, f"旧本地引用无法分析：{exc}", "$ref", ctx.direction, ctx.base_old, ctx.base_new, list(ctx.old_chain), list(ctx.new_chain)))
        return
    try:
        new_schema, new_chain, new_ref_local = dereference(ctx.new_nav, new_schema_raw, list(ctx.new_chain))
    except ReferenceError as exc:
        ctx.add(Finding("unknown", subject, f"新本地引用无法分析：{exc}", "$ref", ctx.direction, ctx.base_old, ctx.base_new, old_chain, list(ctx.new_chain)))
        return

    old_key = "|".join(old_chain)
    new_key = "|".join(new_chain)
    dedup_key = (old_key, new_key, ctx.direction, ".".join(ctx.schema_path))
    if dedup_key in ctx.seen:
        return
    ctx.seen.add(dedup_key)

    resolved = ctx.child(old_chain=old_chain, new_chain=new_chain)
    old_loc = old_ref_local if old_key and old_ref_local else ctx.base_old
    new_loc = new_ref_local if new_key and new_ref_local else ctx.base_new

    if not isinstance(old_schema, dict) or not isinstance(new_schema, dict):
        resolved.add(Finding("unknown", subject, "Schema 不是可比较的对象。布尔 Schema 或非对象值无法按 OpenAPI 3.0 对象规则分析。", "schema", ctx.direction, old_loc, new_loc, old_chain, new_chain))
        return

    inspect_unsupported(resolved, old_schema, new_schema, subject, old_loc, new_loc)

    old_type = schema_type(old_schema)
    new_type = schema_type(new_schema)
    compare_type(resolved, old_schema, new_schema, old_type, new_type, subject, old_loc, new_loc)
    compare_nullable(resolved, old_schema, new_schema, subject, old_loc, new_loc)
    compare_enum(resolved, old_schema, new_schema, old_type, subject, old_loc, new_loc)

    if types_can_have_objects(old_type, new_type, old_schema, new_schema):
        compare_object(resolved, old_schema, new_schema, subject, old_loc, new_loc)
    if old_type == "array" or new_type == "array":
        compare_array(resolved, old_schema, new_schema, old_type, new_type, subject, old_loc, new_loc)


def inspect_unsupported(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], subject: str, old_loc: list[str], new_loc: list[str]) -> None:
    known = SUPPORTED_KEYS | IGNORED_KEYS
    for key in sorted(set(old) | set(new)):
        if key in known:
            continue
        old_has = key in old
        new_has = key in new
        if old_has and new_has and old.get(key) == new.get(key):
            continue
        message = f"约束 {key} 不在可判定范围，本工具不联网补全，也不推断其对旧调用的影响。"
        ctx.add(Finding("unknown", subject, message, key, ctx.direction,
                        join_path(old_loc, key) if old_has else [],
                        join_path(new_loc, key) if new_has else [], ctx.old_chain, ctx.new_chain))


def types_can_have_objects(old_type: str | None, new_type: str | None, old: dict[str, Any], new: dict[str, Any]) -> bool:
    if is_object_schema({"type": old_type}) and (is_object_schema(old) or "required" in old):
        pass
    if is_object_schema({"type": new_type}) and (is_object_schema(new) or "required" in new):
        pass
    inferred_old = old_type in (None, "object") and (isinstance(old.get("properties"), dict) or isinstance(old.get("required"), list))
    inferred_new = new_type in (None, "object") and (isinstance(new.get("properties"), dict) or isinstance(new.get("required"), list))
    return inferred_old and inferred_new


def compare_type(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], old_type: str | None, new_type: str | None, subject: str, old_loc: list[str], new_loc: list[str]) -> None:
    if old_type == new_type:
        return
    # integer is a narrower subset of number, but direction still matters.
    if old_type == "integer" and new_type == "number":
        if ctx.direction == "request":
            return
        add_primitive_break(ctx, old, new, "integer", "number", "type", subject, old_loc, new_loc, sample_value_for_type("integer"), sample_value_for_type("number"))
        return
    if old_type == "number" and new_type == "integer":
        if ctx.direction == "request":
            add_primitive_break(ctx, old, new, "number", "integer", "type", subject, old_loc, new_loc, sample_value_for_type("number"), sample_value_for_type("integer"))
        return
    compatible_untyped_request = ctx.direction == "request" and old_type is None and new_type is not None
    compatible_untyped_response = ctx.direction == "response" and new_type is None and old_type is not None
    # Missing type means no guarantee, but when the other side has a concrete
    # type, the precise substitution is usually still useful. Flag these only
    # in the unsafe direction as breaking.
    if (old_type is None) != (new_type is None):
        if compatible_untyped_request or compatible_untyped_response:
            return
        add_primitive_break(ctx, old, new, old_type or "untyped", new_type or "untyped", "type", subject, old_loc, new_loc,
                           sample_value_for_type(old_type) if old_type else "typed-value",
                           sample_value_for_type(new_type) if new_type else "typed-value")
        return
    if is_object_schema(old) and is_object_schema(new):
        return
    if old_type == "array" or new_type == "array":
        compare_array(ctx, old, new, old_type, new_type, subject, old_loc, new_loc)
        return
    add_primitive_break(ctx, old, new, old_type or "untyped", new_type or "untyped", "type", subject, old_loc, new_loc,
                       sample_value_for_type(old_type) if old_type else "typed-value",
                       sample_value_for_type(new_type) if new_type else "typed-value")


def compare_nullable(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], subject: str, old_loc: list[str], new_loc: list[str]) -> None:
    old_null = nullable(old)
    new_null = nullable(new)
    if old_null == new_null:
        return
    if ctx.direction == "request" and old_null and not new_null:
        add_primitive_break(ctx, old, new, "nullable", "non-nullable", "nullable", subject, old_loc, new_loc, None, sample_for_schema(new, ctx.new_nav, list(ctx.new_chain)))
    elif ctx.direction == "response" and not old_null and new_null:
        add_primitive_break(ctx, old, new, "non-nullable", "nullable", "nullable", subject, old_loc, new_loc, sample_for_schema(old, ctx.old_nav, list(ctx.old_chain)), None)


def compare_enum(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], old_type: str | None, subject: str, old_loc: list[str], new_loc: list[str]) -> None:
    old_values = enum_values(old)
    new_values = enum_values(new)
    old_enum = normalize_enum(old_values)
    new_enum = normalize_enum(new_values)

    if old_enum is None and new_enum is None:
        return
    if ctx.direction == "request":
        # A request enum on only the new side narrows previously accepted
        # input; removing the old enum widens acceptance and is compatible.
        if old_enum is None:
            if new_enum:
                value = value_outside_enum(old, new_enum)
                add_primitive_break(ctx, old, new, "no enum restriction", "enum restriction", "enum", subject, old_loc, new_loc,
                                    value, next(iter(new_enum)) if new_enum else value)
            return
        if new_enum is None:
            return
        removed = old_enum - new_enum
        if removed:
            value = sorted(removed, key=sort_value)[0]
            add_primitive_break(ctx, old, new, f"enum includes {literal(value)}", f"enum excludes {literal(value)}", "enum", subject, old_loc, new_loc,
                                value, sample_for_schema(new, ctx.new_nav, list(ctx.new_chain)) or value)
    else:
        # A response enum on only the new side tightens the output set and is
        # compatible; removing the old enum allows previously excluded values.
        if new_enum is None:
            if old_enum:
                value = value_outside_enum(new, old_enum)
                add_primitive_break(ctx, old, new, "enum restriction", "no enum restriction", "enum", subject, old_loc, new_loc,
                                    sample_for_schema(old, ctx.old_nav, list(ctx.old_chain)) or next(iter(old_enum)), value)
            return
        if old_enum is None:
            return
        added = new_enum - old_enum
        if added:
            value = sorted(added, key=sort_value)[0]
            add_primitive_break(ctx, old, new, f"enum excludes {literal(value)}", f"enum includes {literal(value)}", "enum", subject, old_loc, new_loc,
                                sample_for_schema(old, ctx.old_nav, list(ctx.old_chain)) or value, value)



def value_outside_enum(schema: dict[str, Any], values: set[Any]) -> Any:
    typ = schema_type(schema)
    candidates: list[Any]
    if typ == "integer":
        candidates = [0, 1, 2, 100, -1, 1000]
    elif typ == "number":
        candidates = [0, 1, 1.5, 2.5, 100.5]
    elif typ == "boolean":
        candidates = [True, False]
    elif typ == "object":
        candidates = [{"unexpected": "example"}]
    elif typ == "array":
        candidates = [["unexpected"]]
    else:
        candidates = ["example", "unexpected", "other-value", "not-in-enum", 0, True, {"unexpected": "example"}]
    for candidate in candidates:
        try:
            if candidate not in values:
                return candidate
        except TypeError:
            continue
    counter = 0
    while True:
        candidate = f"value-{counter}" if typ in (None, "string") else counter
        if candidate not in values:
            return candidate
        counter += 1

def normalize_enum(values: list[Any] | None) -> set[Any] | None:
    if values is None:
        return None
    # JSON null compatibility is handled by nullable so that enum directions
    # remain legible.
    normalized: set[Any] = set()
    for value in values:
        if value is None:
            continue
        try:
            normalized.add(value)
        except TypeError:
            normalized.add(repr(value))
    return normalized


def literal(value: Any) -> str:
    if isinstance(value, str):
        return f'"{value}"'
    return str(value)


def sort_value(value: Any) -> tuple[int, str | float, str]:
    if isinstance(value, bool):
        return (0, int(value), type(value).__name__)
    if isinstance(value, (int, float)):
        return (0, value, type(value).__name__)
    return (1, str(value), type(value).__name__)


def add_primitive_break(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], old_constraint: str, new_constraint: str, constraint: str, subject: str, old_loc: list[str], new_loc: list[str], old_value: Any, new_value: Any) -> None:
    if ctx.direction == "request":
        message = f"请求约束从 {old_constraint} 收窄为 {new_constraint}，仍满足旧契约的值可能被新服务拒绝。"
        old_sample, new_sample = embed_schema_sample(ctx, old_value, new_value)
    else:
        message = f"响应保证从 {old_constraint} 变为 {new_constraint}，新服务可能返回旧客户端不能处理的值或空值。"
        old_sample, new_sample = embed_schema_sample(ctx, old_value, new_value)
    ctx.add(Finding("breaking", subject, message, constraint, ctx.direction, old_loc, new_loc, ctx.old_chain, ctx.new_chain, old_sample, new_sample,
                    "样例只展示触发该差异的最小载荷；未尝试伪造范围外约束。"))


def embed_schema_sample(ctx: Ctx, old_value: Any, new_value: Any) -> tuple[Any, Any]:
    if ctx.direction == "request":
        old_req = build_request_example(ctx, old_value)
        return old_req, None
    new_resp = build_response_example(ctx, new_value)
    return None, new_resp


def compare_object(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], subject: str, old_loc: list[str], new_loc: list[str]) -> None:
    old_props = old.get("properties") if isinstance(old.get("properties"), dict) else {}
    new_props = new.get("properties") if isinstance(new.get("properties"), dict) else {}
    old_required = set(old.get("required", [])) if isinstance(old.get("required"), list) else set()
    new_required = set(new.get("required", [])) if isinstance(new.get("required"), list) else set()

    for name in sorted(old_required | new_required, key=str):
        exists_on_both_sides = name in old_props and name in new_props
        if exists_on_both_sides and name in old_required and name not in new_required and ctx.direction == "response":
            add_required_loss(ctx, name, old, new, subject, old_loc, new_loc, required_location=True)
        if exists_on_both_sides and name not in old_required and name in new_required and ctx.direction == "request":
            add_required_addition(ctx, name, old, new, subject, old_loc, new_loc, required_location=True)

    for name in sorted(set(old_props) | set(new_props), key=str):
        old_prop = old_props.get(name)
        new_prop = new_props.get(name)
        child_subject = f"{subject}.{name}"
        child_path = ctx.schema_path + ("properties", str(name))
        child = ctx.child(schema_path=child_path)
        child.base_old = join_path(old_loc, "properties", str(name))
        child.base_new = join_path(new_loc, "properties", str(name))
        if old_prop is not None and new_prop is None:
            if ctx.direction == "response" and name in old_required:
                add_required_loss(ctx, name, old, new, subject, old_loc, new_loc, required_location=False)
            continue
        if old_prop is None and new_prop is not None:
            if ctx.direction == "request" and name in new_required:
                add_required_addition(ctx, name, old, new, subject, old_loc, new_loc, required_location=False)
            continue
        compare_schema(child, old_prop, new_prop, child_subject)


def add_required_addition(ctx: Ctx, name: str, old: dict[str, Any], new: dict[str, Any], subject: str, old_loc: list[str], new_loc: list[str], required_location: bool) -> None:
    new_props = new.get("properties", {})
    prop_schema = new_props.get(name, {}) if isinstance(new_props, dict) else {}
    value = sample_for_schema(prop_schema, ctx.new_nav, list(ctx.new_chain))
    if ctx.direction == "request":
        old_sample, _ = embed_schema_sample(ctx, missing_marker_at(ctx.schema_path, name), None)
        ctx.add(Finding("breaking", f"{subject}.{name}", f"新请求对象新增必填字段 {name}，旧请求可以省略它。", "object.required", "request",
                        join_path(old_loc, "required" if required_location else ("properties", name)), join_path(new_loc, "required"), ctx.old_chain, ctx.new_chain,
                        old_sample, None, "请求样例省略了新必填字段。"))


def add_required_loss(ctx: Ctx, name: str, old: dict[str, Any], new: dict[str, Any], subject: str, old_loc: list[str], new_loc: list[str], required_location: bool) -> None:
    old_props = old.get("properties", {})
    prop_schema = old_props.get(name, {}) if isinstance(old_props, dict) else {}
    value = sample_for_schema(prop_schema, ctx.old_nav, list(ctx.old_chain))
    if ctx.direction == "response":
        _, new_sample = embed_schema_sample(ctx, None, missing_marker_at(ctx.schema_path, name))
        ctx.add(Finding("breaking", f"{subject}.{name}", f"新响应不再保证字段 {name} 一定存在，旧客户端可能读取空值或缺失。", "object.required", "response",
                        join_path(old_loc, "required"), join_path(new_loc, "required" if required_location else ("properties", name)), ctx.old_chain, ctx.new_chain,
                        None, new_sample, "响应样例省略了旧契约保证存在的字段。"))


def missing_marker_at(schema_path: tuple[str, ...], name: str) -> Any:
    # This sentinel is consumed while building a concrete example: it tells the
    # builder where the absent property is.
    return {"__missing_required__": name, "path": list(schema_path)}


def compare_array(ctx: Ctx, old: dict[str, Any], new: dict[str, Any], old_type: str | None, new_type: str | None, subject: str, old_loc: list[str], new_loc: list[str]) -> None:
    if old_type == "array" and new_type != "array":
        if ctx.direction == "request":
            value = sample_for_schema(old.get("items", {"type": "string"}), ctx.old_nav, list(ctx.old_chain))
            add_primitive_break(ctx, old, new, "array", new_type or "non-array", "type", subject, old_loc, new_loc, [value], sample_for_schema(new, ctx.new_nav, list(ctx.new_chain)))
        else:
            add_primitive_break(ctx, old, new, "array", new_type or "non-array", "type", subject, old_loc, new_loc,
                               sample_for_schema(old, ctx.old_nav, list(ctx.old_chain)), sample_for_schema(new, ctx.new_nav, list(ctx.new_chain)))
        return
    if new_type == "array" and old_type != "array":
        if ctx.direction == "response":
            value = sample_for_schema(new.get("items", {"type": "string"}), ctx.new_nav, list(ctx.new_chain))
            add_primitive_break(ctx, old, new, old_type or "non-array", "array", "type", subject, old_loc, new_loc,
                               sample_for_schema(old, ctx.old_nav, list(ctx.old_chain)), [value])
        return
    old_items = old.get("items")
    new_items = new.get("items")
    if old_items is None or new_items is None:
        return
    child = ctx.child(schema_path=ctx.schema_path + ("items",))
    child.base_old = join_path(old_loc, "items")
    child.base_new = join_path(new_loc, "items")
    compare_schema(child, old_items, new_items, f"{subject}[]")


def sample_for_schema(schema: Any, nav: SpecNavigator, chain: list[str], depth: int = 0) -> Any:
    if depth > 5:
        return None
    try:
        resolved, _, _ = dereference(nav, schema, chain)
    except ReferenceError:
        return None
    if not isinstance(resolved, dict):
        return None
    enum = enum_values(resolved)
    if enum:
        for value in enum:
            if value is not None:
                return value
    typ = schema_type(resolved)
    if typ is None:
        if isinstance(resolved.get("properties"), dict):
            typ = "object"
        elif "items" in resolved:
            typ = "array"
        elif enum:
            return enum[0]
        else:
            return "example"
    if typ == "string":
        return "example"
    if typ == "integer":
        return 1
    if typ == "number":
        return 1.5
    if typ == "boolean":
        return True
    if typ == "array":
        item = sample_for_schema(resolved.get("items", {"type": "string"}), nav, chain, depth + 1)
        return [item]
    if typ == "object":
        result: dict[str, Any] = {}
        props = resolved.get("properties") if isinstance(resolved.get("properties"), dict) else {}
        required = resolved.get("required") if isinstance(resolved.get("required"), list) else []
        for name in required:
            if name in props:
                value = sample_for_schema(props[name], nav, chain, depth + 1)
                if value is not None:
                    result[str(name)] = value
        if not result and props:
            first_name = next(iter(props))
            result[str(first_name)] = sample_for_schema(props[first_name], nav, chain, depth + 1)
        return result
    return None


def sample_value_for_type(typ: str | None) -> Any:
    if typ == "string":
        return "example"
    if typ == "integer":
        return 1
    if typ == "number":
        return 1.5
    if typ == "boolean":
        return True
    if typ == "array":
        return ["example"]
    if typ == "object":
        return {}
    return "example"


def build_request_example(ctx: Ctx, value: Any = None) -> dict[str, Any]:
    if isinstance(value, dict) and {"method", "path"} <= set(value):
        return value
    request = base_old_request_from_context(ctx)
    logical_path = tuple(str(part) for part in ctx.schema_path)
    if logical_path and logical_path[0] in {"query", "header", "cookie", "path"} and len(logical_path) >= 2:
        location, name = logical_path[0], logical_path[1]
        if location == "path":
            request["path"] = request["path"].replace(f"{{{name}}}", str(value))
        else:
            key = {"query": "query", "header": "headers", "cookie": "cookies"}[location]
            request[key] = {name: value}
        return request
    root = sample_for_schema(ctx.old_root_schema, ctx.old_nav, [], 0)
    if root is not None or value is not None:
        request["body"] = place_body_value(root if root is not None else {}, logical_path, value, "request")
    return request


def base_old_request_from_context(ctx: Ctx) -> dict[str, Any]:
    path_item = ctx.old_nav.doc.get("paths", {}).get(ctx.operation_path, {}) if isinstance(ctx.old_nav.doc, dict) else {}
    operation = {}
    if isinstance(path_item, dict):
        try:
            path_item, _, _ = dereference(ctx.old_nav, path_item, [])
            operation = path_item.get(ctx.method.lower(), {}) if isinstance(path_item, dict) else {}
            operation, _, _ = dereference(ctx.old_nav, operation, [])
        except ReferenceError:
            operation = {}
    path_params = path_item.get("parameters", []) if isinstance(path_item, dict) else []
    op_params = operation.get("parameters", []) if isinstance(operation, dict) else []
    params = merge_parameters([p for p in path_params if isinstance(p, dict)], op_params)
    return make_old_method_request(ctx.operation_path, ctx.method, params, nav=ctx.old_nav)


def build_response_example(ctx: Ctx, value: Any = None) -> dict[str, Any]:
    response: dict[str, Any] = {}
    path = tuple(str(part) for part in ctx.schema_path)
    if path and path[0] == "statusCode":
        response["statusCode"] = int(path[1]) if str(path[1]).isdigit() else str(path[1])
        body_path = path[3:] if len(path) >= 3 and path[2] == "body" else path[1:]
    else:
        body_path = path
    root = sample_for_schema(ctx.new_root_schema, ctx.new_nav, [], 0)
    if root is not None or value is not None:
        response["body"] = place_body_value(root if root is not None else {}, body_path, value, "response")
    return response


def render_request_path(path: str, value: Any, schema_path: tuple[str, ...]) -> str:
    rendered = path
    if schema_path and len(schema_path) >= 2 and schema_path[0] == "path":
        rendered = rendered.replace(f"{{{schema_path[1]}}}", str(value))
    return rendered


def place_body_value(root: Any, path: tuple[str, ...], value: Any, direction: Direction) -> Any:
    if isinstance(value, dict) and "__missing_required__" in value:
        name = str(value["__missing_required__"])
        return omit_at(root, path, name)
    if not path:
        return value
    if path[0] in {"query", "header", "cookie", "path"}:
        return root
    return set_at(root, path, value)


def set_at(root: Any, path: tuple[str, ...], value: Any) -> Any:
    if not path:
        return value
    head, rest = path[0], path[1:]
    if head == "items":
        if isinstance(root, list) and root:
            cloned = deepcopy(root)
            cloned[0] = set_at(cloned[0], rest, value)
            return cloned
        return [set_at({}, rest, value)]
    if head == "properties":
        return set_at(root, rest, value)
    if not isinstance(root, dict):
        root = {}
    cloned = deepcopy(root)
    cloned[head] = set_at(cloned.get(head), rest, value)
    return cloned


def omit_at(root: Any, path: tuple[str, ...], name: str) -> Any:
    if not path:
        if isinstance(root, dict):
            cloned = deepcopy(root)
            cloned.pop(name, None)
            return cloned
        return root
    head, rest = path[0], path[1:]
    if head == "items":
        if isinstance(root, list) and root:
            cloned = deepcopy(root)
            cloned[0] = omit_at(cloned[0], rest, name)
            return cloned
        return [omit_at({}, rest, name)]
    if head == "properties":
        return omit_at(root, rest, name)
    if not isinstance(root, dict):
        root = {}
    cloned = deepcopy(root)
    if head in cloned:
        cloned[head] = omit_at(cloned[head], rest, name)
    else:
        cloned[head] = omit_at({}, rest, name)
    return cloned


def make_old_path_request(path: str) -> dict[str, Any]:
    return {"method": "GET", "path": path}


def make_old_method_request(path: str, method: str, params: list[dict[str, Any]], required_param: tuple[Any, Any] | None = None, nav: SpecNavigator | None = None) -> dict[str, Any]:
    request: dict[str, Any] = {"method": method, "path": path}
    query: dict[str, Any] = {}
    headers: dict[str, Any] = {}
    cookies: dict[str, Any] = {}
    for param in params:
        if not isinstance(param, dict):
            continue
        name = str(param.get("name", ""))
        location = param.get("in")
        is_newly_required = required_param == (param.get("name"), param.get("in"))
        required = param.get("required") is True and not is_newly_required
        if not name or not required or is_newly_required:
            continue
        # The sample demonstrates a request valid under the old contract. It
        # does not populate the newly required parameter that did not exist.
        schema = param.get("schema", {}) if isinstance(param.get("schema"), dict) else {}
        value = sample_for_schema(schema, nav or SpecNavigator({}), [])
        if location == "query":
            query[name] = value
        elif location == "header":
            headers[name] = value
        elif location == "cookie":
            cookies[name] = value
        elif location == "path":
            request["path"] = request["path"].replace("{" + name + "}", str(value))
    if query:
        request["query"] = query
    if headers:
        request["headers"] = headers
    if cookies:
        request["cookies"] = cookies
    return request



def add_compatible_operations(old_doc: dict[str, Any], new_doc: dict[str, Any], findings: list[Finding]) -> None:
    old_paths = old_doc.get("paths", {})
    new_paths = new_doc.get("paths", {})
    if not isinstance(old_paths, dict) or not isinstance(new_paths, dict):
        return
    old_nav = SpecNavigator(old_doc)
    new_nav = SpecNavigator(new_doc)
    for path in sorted(set(old_paths) & set(new_paths)):
        try:
            old_item, _, _ = dereference(old_nav, old_paths.get(path), [])
            new_item, _, _ = dereference(new_nav, new_paths.get(path), [])
        except ReferenceError:
            continue
        if not isinstance(old_item, dict) or not isinstance(new_item, dict):
            continue
        for method in sorted(m for m in set(old_item) | set(new_item) if m.lower() in HTTP_METHODS):
            upper = method.upper()
            old_op = old_item.get(method.lower()) or old_item.get(method.upper())
            new_op = new_item.get(method.lower()) or new_item.get(method.upper())
            if not isinstance(old_op, dict) or not isinstance(new_op, dict):
                continue
            if any(f.method == upper and f.operation_path == path for f in findings):
                continue
            base = [f"#/paths/{escape_path(path)}", method.lower()]
            findings.append(Finding(
                "compatible",
                f"{upper} {path}",
                "在工具支持的参数、请求体、响应和本地 schema 约束范围内，未发现破坏；说明性字段变化已忽略。",
                "operation",
                "operation",
                base,
                list(base),
            ))


def enrich_operation_context(findings: list[Finding]) -> None:
    for finding in findings:
        if finding.method and finding.operation_path:
            continue
        for loc in (finding.old_location, finding.new_location):
            parsed = operation_from_location(loc)
            if parsed:
                finding.method, finding.operation_path = parsed
                break


def operation_from_location(loc: list[str]) -> tuple[str, str] | None:
    if len(loc) < 2 or not isinstance(loc[0], str) or not loc[0].startswith("#/paths/"):
        return None
    encoded = loc[0][len("#/paths/"):]
    path = unescape_pointer(encoded)
    method = str(loc[1]).upper()
    if method.lower() not in HTTP_METHODS:
        return None
    return method, path


def summarize_findings(findings: list[Finding], old_paths: dict[str, Any], new_paths: dict[str, Any]) -> Status:
    if any(f.status == "breaking" for f in findings):
        return "breaking"
    if any(f.status == "unknown" for f in findings):
        return "unknown"
    return "compatible"


def summary_counts(findings: list[Finding]) -> dict[str, int]:
    return {
        "compatible": sum(1 for f in findings if f.status == "compatible"),
        "breaking": sum(1 for f in findings if f.status == "breaking"),
        "unknown": sum(1 for f in findings if f.status == "unknown"),
    }


def group_operations(findings: list[Finding]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    path_only: list[dict[str, Any]] = []
    for index, finding in enumerate(findings):
        item = finding.as_dict()
        item["id"] = str(index)
        if finding.direction in {"path", "operation"}:
            # subject normally begins "METHOD /path"; method-specific removed
            # path findings can be kept under a path group.
            parts = finding.subject.split(" ", 1)
            if len(parts) == 2 and parts[0].isupper():
                key = (parts[0], parts[1])
                group = groups.setdefault(key, new_operation_group(parts[0], parts[1]))
            else:
                path_only.append(item)
                continue
        else:
            key = (finding.method, finding.operation_path)
            group = groups.setdefault(key, new_operation_group(finding.method, finding.operation_path))
        group["findings"].append(item)
        group["status"] = combine_status(group["status"], finding.status)
    operations = list(groups.values())
    operations.sort(key=lambda group: (group["path"], group["method"]))
    if path_only:
        # Path-level references still need visibility; expose them in a pseudo
        # operation while keeping concrete path removals in normal groups.
        operations.append({
            "method": "*",
            "path": "*",
            "status": combine_many(path_only),
            "findings": path_only,
        })
    return operations


def new_operation_group(method: str, path: str) -> dict[str, Any]:
    return {"method": method, "path": path, "status": "compatible", "findings": []}


def combine_status(current: Status, candidate: Status) -> Status:
    order = {"compatible": 0, "unknown": 1, "breaking": 2}
    return candidate if order[candidate] > order[current] else current


def combine_many(items: list[dict[str, Any]]) -> Status:
    result: Status = "compatible"
    for item in items:
        result = combine_status(result, item["status"])
    return result


def validate_openapi_document(doc: Any, label: str) -> None:
    if not isinstance(doc, dict):
        raise ValueError(f"{label} 文档必须是 JSON 对象")
    if "paths" not in doc or not isinstance(doc.get("paths"), dict):
        raise ValueError(f"{label} 文档必须包含 OpenAPI 3.0 的 paths 对象")
